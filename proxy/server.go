package proxy

import (
	"context"
	"fmt"
	"gopkg.in/yaml.v3"
	"io/ioutil"
	"net"
	"os"
	"strings"
	"time"

	"github.com/AdguardTeam/golibs/log"
	"github.com/miekg/dns"
	"github.com/quic-go/quic-go"
)

const (
	ACCESS_IGNORE = 0
	ACCESS_NORMAL = 1
	ACCESS_BLOCK  = 2
)

// startListeners configures and starts listener loops
func (p *Proxy) startListeners(ctx context.Context) error {
	err := p.createUDPListeners(ctx)
	if err != nil {
		return err
	}

	err = p.createTCPListeners(ctx)
	if err != nil {
		return err
	}

	err = p.createTLSListeners()
	if err != nil {
		return err
	}

	err = p.createHTTPSListeners()
	if err != nil {
		return err
	}

	err = p.createQUICListeners()
	if err != nil {
		return err
	}

	err = p.createDNSCryptListeners()
	if err != nil {
		return err
	}

	for _, l := range p.udpListen {
		go p.udpPacketLoop(l, p.requestGoroutinesSema)
	}

	for _, l := range p.tcpListen {
		go p.tcpPacketLoop(l, ProtoTCP, p.requestGoroutinesSema)
	}

	for _, l := range p.tlsListen {
		go p.tcpPacketLoop(l, ProtoTLS, p.requestGoroutinesSema)
	}

	for _, l := range p.httpsListen {
		go func(l net.Listener) { _ = p.httpsServer.Serve(l) }(l)
	}

	for _, l := range p.h3Listen {
		go func(l *quic.EarlyListener) { _ = p.h3Server.ServeListener(l) }(l)
	}

	for _, l := range p.quicListen {
		go p.quicPacketLoop(l, p.requestGoroutinesSema)
	}

	for _, l := range p.dnsCryptUDPListen {
		go func(l *net.UDPConn) { _ = p.dnsCryptServer.ServeUDP(l) }(l)
	}

	for _, l := range p.dnsCryptTCPListen {
		go func(l net.Listener) { _ = p.dnsCryptServer.ServeTCP(l) }(l)
	}

	return nil
}

func (p *Proxy) accessDeny(ip string) bool {
	if p.AccessDeny == nil {
		return false
	}

	b, ok := p.AccessDeny[ip]
	if ok && b {
		return true
	}
	return false
}

func (p *Proxy) getAccessControlType(name string, ip string) int {
	ac, ok := p.AccessControl[ip]
	if !ok {
		if p.accessDeny(ip) {
			return ACCESS_BLOCK
		} else {
			return ACCESS_NORMAL
		}
	}

	at, ok := ac[name]
	if !ok {
		if p.accessDeny(ip) {
			return ACCESS_BLOCK
		} else {
			return ACCESS_NORMAL
		}
	}

	if at == ACCESS_NORMAL {
		if p.accessDeny(ip) {
			return ACCESS_BLOCK
		} else {
			return ACCESS_NORMAL
		}
	}

	if at <= ACCESS_BLOCK {
		return at
	}

	//下面是时间限制
	min := int(time.Now().Unix() / 60)
	key := fmt.Sprintf("%s-%s-%d", ip, name, min)
	_, ok = p.LimitMap[key]
	if ok {
		//找到了，已有的一分钟
		return at
	}

	step := 1
	for i := 1; i < 10; i++ {
		//10分钟内的连续计算
		key := fmt.Sprintf("%s-%s-%d", ip, name, min-i)
		_, ok = p.LimitMap[key]
		if ok {
			step = i
			break
		}
	}

	//减少分钟数
	p.mu.Lock()
	p.LimitMap[key] = true
	if at-step > ACCESS_BLOCK {
		ac[name] = at - step
	} else {
		ac[name] = ACCESS_BLOCK
	}
	p.mu.Unlock()

	bs, err := yaml.Marshal(p.OptionPtr)
	if err != nil {
		log.Error("getAccessControlType,Marshal:%v", err)
	}

	ioutil.WriteFile("config.yaml", bs, os.ModePerm)
	return at
}

// 先考虑ip单独设置然后再全局设置
func (p *Proxy) getFinalAccessControl(name string, ip string) int {
	at := p.getAccessControlType(name, ip)
	if at != ACCESS_NORMAL {
		return at
	}
	return p.getAccessControlType(name, "all")
}

func (p *Proxy) writeLog(at int, clientIp string, domain string, name string) {
	t := time.Now()
	date := t.Format("20060102")
	if p.QueryFile == nil || p.QueryFileDate != date {
		if p.QueryFile != nil {
			p.QueryFile.Close()
		}

		name := fmt.Sprintf("log/%s.log", date)
		queryFile, err := os.OpenFile(name, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
		if err != nil {
			log.Fatalf("queryFile,OpenFile:%v", err)
		}
		p.QueryFileDate = date
		p.QueryFile = queryFile
	}

	loginfo := fmt.Sprintf("%d\t%d\t%s\t%s\t%s\n", time.Now().Unix(), at, clientIp, domain, name)
	p.QueryFile.WriteString(loginfo)
}

// handleDNSRequest processes the incoming packet bytes and returns with an optional response packet.
func (p *Proxy) handleDNSRequest(d *DNSContext) error {
	p.logDNSMessage(d.Req)

	clientIp := strings.Split(d.Addr.String(), ":")[0]
	for _, r := range d.Req.Question {
		if strings.HasSuffix(r.Name, ".local.") {
			//过滤local
			continue
		}

		name := r.Name
		do := strings.Split(r.Name, ".")
		ln := len(do)
		if ln < 3 {
			log.Info("too short name %s", name)
		} else {
			name = fmt.Sprintf("%s.%s", do[ln-3], do[ln-2])
		}

		if (name == "com.cn" || name == "net.cn") && ln > 3 {
			name = fmt.Sprintf("%s.%s.%s", do[ln-4], do[ln-3], do[ln-2])
		}

		at := p.getFinalAccessControl(name, clientIp)
		if at != ACCESS_IGNORE {
			p.writeLog(at, clientIp, name, r.Name)
			//loginfo := fmt.Sprintf("%d\t%d\t%s\t%s\t%s\n", time.Now().Unix(), at, clientIp, name, r.Name)
			//p.QueryFile.WriteString(loginfo)
		}
		if at == ACCESS_BLOCK {
			d.Res = p.genARecord(d.Req, net.IP{0, 0, 0, 0}, p.BlockTTL)
			p.respond(d)
			return nil
		}
	}

	if d.Req.Response {
		log.Debug("Dropping incoming Reply packet from %s", d.Addr.String())
		return nil
	}

	if p.BeforeRequestHandler != nil {
		ok, err := p.BeforeRequestHandler(p, d)
		if err != nil {
			log.Error("Error in the BeforeRequestHandler: %s", err)
			d.Res = p.genServerFailure(d.Req)
			p.respond(d)
			return nil
		}
		if !ok {
			return nil // do nothing, don't reply
		}
	}

	// ratelimit based on IP only, protects CPU cycles and outbound connections
	if d.Proto == ProtoUDP && p.isRatelimited(d.Addr.Addr()) {
		log.Tracef("Ratelimiting %v based on IP only", d.Addr)
		return nil // do nothing, don't reply, we got ratelimited
	}

	if len(d.Req.Question) != 1 {
		log.Debug("got invalid number of questions: %v", len(d.Req.Question))
		d.Res = p.genServerFailure(d.Req)
	}

	// refuse ANY requests (anti-DDOS measure)
	if p.RefuseAny && len(d.Req.Question) > 0 && d.Req.Question[0].Qtype == dns.TypeANY {
		log.Tracef("Refusing type=ANY request")
		d.Res = p.genNotImpl(d.Req)
	}

	var err error

	if d.Res == nil {
		if len(p.UpstreamConfig.Upstreams) == 0 {
			panic("SHOULD NOT HAPPEN: no default upstreams specified")
		}

		// execute the DNS request
		// if there is a custom middleware configured, use it
		if p.RequestHandler != nil {
			err = p.RequestHandler(p, d)
		} else {
			err = p.Resolve(d)
		}

		if err != nil {
			err = fmt.Errorf("talking to dns upstream: %w", err)
		}
	}

	p.logDNSMessage(d.Res)
	p.respond(d)

	return err
}

// respond writes the specified response to the client (or does nothing if d.Res is empty)
func (p *Proxy) respond(d *DNSContext) {
	// d.Conn can be nil in the case of a DoH request.
	if d.Conn != nil {
		_ = d.Conn.SetWriteDeadline(time.Now().Add(defaultTimeout))
	}

	var err error

	switch d.Proto {
	case ProtoUDP:
		err = p.respondUDP(d)
	case ProtoTCP:
		err = p.respondTCP(d)
	case ProtoTLS:
		err = p.respondTCP(d)
	case ProtoHTTPS:
		err = p.respondHTTPS(d)
	case ProtoQUIC:
		err = p.respondQUIC(d)
	case ProtoDNSCrypt:
		err = p.respondDNSCrypt(d)
	default:
		err = fmt.Errorf("SHOULD NOT HAPPEN - unknown protocol: %s", d.Proto)
	}

	if err != nil {
		logWithNonCrit(err, fmt.Sprintf("responding %s request", d.Proto))
	}
}

// Set TTL value of all records according to our settings
func (p *Proxy) setMinMaxTTL(r *dns.Msg) {
	for _, rr := range r.Answer {
		originalTTL := rr.Header().Ttl
		newTTL := respectTTLOverrides(originalTTL, p.CacheMinTTL, p.CacheMaxTTL)

		if originalTTL != newTTL {
			log.Debug("Override TTL from %d to %d", originalTTL, newTTL)
			rr.Header().Ttl = newTTL
		}
	}
}

func (p *Proxy) genServerFailure(request *dns.Msg) *dns.Msg {
	return p.genWithRCode(request, dns.RcodeServerFailure)
}

func (p *Proxy) genNotImpl(request *dns.Msg) (resp *dns.Msg) {
	resp = p.genWithRCode(request, dns.RcodeNotImplemented)
	// NOTIMPL without EDNS is treated as 'we don't support EDNS', so
	// explicitly set it.
	resp.SetEdns0(1452, false)

	return resp
}

func (p *Proxy) genWithRCode(req *dns.Msg, code int) (resp *dns.Msg) {
	resp = &dns.Msg{}
	resp.SetRcode(req, code)
	resp.RecursionAvailable = true

	return resp
}

func (p *Proxy) logDNSMessage(m *dns.Msg) {
	if m == nil {
		return
	}

	if m.Response {
		log.Tracef("OUT: %s", m)
	} else {
		log.Tracef("IN: %s", m)
	}
}

func (s *Proxy) genARecord(request *dns.Msg, ip net.IP, ttl uint32) *dns.Msg {
	resp := s.makeResponse(request)
	resp.Answer = append(resp.Answer, s.genAnswerA(request, ip, ttl))
	return resp
}

func (s *Proxy) hdr(req *dns.Msg, rrType uint16, ttl uint32) (h dns.RR_Header) {
	return dns.RR_Header{
		Name:   req.Question[0].Name,
		Rrtype: rrType,
		Ttl:    ttl,
		Class:  dns.ClassINET,
	}
}

func (s *Proxy) genAnswerA(req *dns.Msg, ip net.IP, ttl uint32) (ans *dns.A) {
	return &dns.A{
		Hdr: s.hdr(req, dns.TypeA, ttl),
		A:   ip,
	}
}

func (s *Proxy) makeResponse(req *dns.Msg) (resp *dns.Msg) {
	resp = &dns.Msg{
		MsgHdr: dns.MsgHdr{
			RecursionAvailable: true,
		},
		Compress: true,
	}

	resp.SetReply(req)

	return resp
}
