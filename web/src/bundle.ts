
let server = ''
let data: any = undefined

let ipNameMap: any = {
  '192.168.31.200': 'mac-mini',
  '192.168.31.218': '小米笔记本',
  '192.168.31.251': '公司MBP',
  '192.168.31.162': '小米手机',
  '	192.168.31.241': 'ipad2018',
  '192.168.31.254': '华为P30'
}

function parseQuery(queryString: string) {
  var query: any = {}
  var pairs = (queryString[0] === '?' ? queryString.substring(1) : queryString).split('&')
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=')
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '')
  }
  return query
}

function fetchGet(path: string, cache: RequestCache, callback: (data: any) => void) {
  fetch(`${server}${path}`, { cache: cache })
    .then(response => response.json())
    .then(function (resp) {
      if (resp.code != 200) {
        console.log('fetchGet,not 200', resp)
        return
      }

      callback(resp.data)
    })
    .catch(function (error) {
      console.log('fetchGet Failed', error)
    })
}


function fetchPost(path: string, body: any, cache: RequestCache, callback: (data: any)=>void) {
  fetch(`${server}${path}`, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: cache, // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(body) // body data type must match "Content-Type" header
  })
    .then(response => response.json())
    .then(function (resp) {
      if (resp.code != 200) {
        console.log('transWords fetch,not 200', resp)
        return
      }

      callback(resp.data)
    })
    .catch(function (error) {
      console.log('fetchPost Failed', error)
    })
}


function renderFilterIpSelect(ips: string[]) {
  let html = '<option value="">all</option>'
  for (let ip of ips) {
    let name = ip
    if (ipNameMap[ip]) {
      name = ipNameMap[ip]
    }
    html += `<option value="${ip}">${name}</option>`
  }

  //@ts-ignore
  document.getElementById('filterIp').innerHTML = html
}

function renderQuerylogTable(data: any, unique: boolean, freshIp: boolean) {
  let ipMap: any = {}
  let html = ''
  let domainMap: any = {}
  for (let item of data) {
    if (unique && domainMap[item[3]]) {
      continue
    }
    domainMap[item[3]] = 1
    ipMap[item[2]] = 1
    let date = new Date(parseInt(item[0])*1000)
    let at = item[1]
    switch (at) {
      case '0':
        at = '忽略'
        break
      case '1':
        at = '正常'
        break
      case '2':
        at = '拦截'
        break
      default:
        break
    }
    let ip = item[2]
    if (ipNameMap[ip]) {
      ip += `(${ipNameMap[ip]})`
    }
    html += `<tr>
    <td>${date.toLocaleString()}</td>
    <td>${at}</td>
    <td>${ip}</td>
    <td>${item[3]}</td>
    <td>${item[4]?item[4]:''}</td>
    <td>
      <select name="opt" class="form-select" domain="${item[3]}">
        <option value="">不动</option>
        <option value="0">忽略</option>
        <option value="1">正常</option>
        <option value="2">拦截</option>
      </select>
    </td>
    </tr>`
  }

  //@ts-ignore
  document.getElementById('querylog').innerHTML = html
  document.querySelectorAll("select[name='opt']").forEach((select) => {
    console.log('select', select)
    select.addEventListener('change', optChange)
  })
  if (freshIp) {
    renderFilterIpSelect(Object.keys(ipMap))
  }
}

function filterIpChange() {
  //@ts-ignore
  let ip = document.getElementById('filterIp').value
  if (ip == "") {
    renderQuerylogTable(data, true, false)
    return
  }

  let items: any = []
  for (let item of data) {
    if (ip != item[2]) {
      continue
    }
    items.push(item)
  }
  renderQuerylogTable(items, false, false)
}

function accessTypeChange() {
  //@ts-ignore
  let at = document.getElementById('accessType').value
  if (at == "") {
    renderQuerylogTable(data, true, false)
    return
  }

  let items: any = []
  for (let item of data) {
    if (at != item[1]) {
      continue
    }
    items.push(item)
  }
  renderQuerylogTable(items, false, false)
}

function optChange(event: any) {
  let opt = event.target.value
  if (opt == "") {
    return
  }

  let at: number = parseInt(opt)
  //@ts-ignore
  let ip: string = document.getElementById('filterIp').value
  if (at == 2) {
    //忽略就全部忽略
    ip = ""
  }
  let domain = event.target.getAttribute('domain')
  fetchPost('/api/access-control/update', {accessType: at, ip: ip, domain: domain}, 'no-cache', (rspData) => {
    console.log(rspData)
  })
}

function initDatesSelect() {
  let ts = Date.now() - 3600*8*1000
  let html = ''
  for (let i=0;i<10;i++) {
    let date = new Date(ts)
    let str = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${(date.getDate()).toString().padStart(2, '0')}`
    html += `<option value="${str}">${str}</option>`
    ts -= 3600*24*1000
  }
  //@ts-ignore
  document.getElementById('date').innerHTML = html
}

function queryLog() {
  //@ts-ignore
  let date = document.getElementById('date').value
  if (date == "") {
    return
  }

  //@ts-ignore
  document.getElementById('querylog').innerHTML = ''
  fetchPost('/api/querylog/get', {date: date, ip: "", bufSize: 1024*1024}, 'no-cache', (rspData) => {
    data = rspData
    renderQuerylogTable(rspData, true, true)
  })
}

function initIndex(query: any) {
  initDatesSelect()
  queryLog()

  //@ts-ignore
  document.getElementById('date').addEventListener('change', queryLog)
  //@ts-ignore
  document.getElementById('filterIp').addEventListener('change', filterIpChange)
  //@ts-ignore
  document.getElementById('accessType').addEventListener('change', accessTypeChange)
}

function renderDenyTable(data: any) {
  let html = ''
  for (let item of data) {
    let ip = item[0]
    if (ipNameMap[ip]) {
      ip += `(${ipNameMap[ip]})`
    }
    html += `<tr>
    <td>${ip}</td>
    <td>${item[1]}</td>
    </tr>`
  }

  //@ts-ignore
  document.getElementById('denyTable').innerHTML = html
}


function renderControlTable(data: any) {
  data.sort((a:any,b:any)=> b[2] - a[2])
  let html = ''
  for (let item of data) {
    let control = item[2]
    switch (control) {
      case '0':
        control = '忽略'
        break
      case '1':
        control = '正常'
        break
      case '2':
        control = '拦截'
        break
      default:
        break
    }
    let ip = item[0]
    if (ipNameMap[ip]) {
      ip += `(${ipNameMap[ip]})`
    }
    html += `<tr>
    <td>${ip}</td>
    <td>${item[1]}</td>
    <td>${control}</td>
    </tr>`
  }

  //@ts-ignore
  document.getElementById('controlTable').innerHTML = html
}

function denySubmit(event: any) {
  //@ts-ignore
  let ip: string = document.getElementById('ip').value.trim()
  //@ts-ignore
  let at: number = parseInt(document.getElementById('deny').value)
  let deny = at == 1? true: false
  
  fetchPost('/api/access-deny/update', {deny: deny, ip: ip}, 'no-cache', (rspData) => {
    console.log(rspData)
  })
}

function controlSubmit(event: any) {
  //@ts-ignore
  let ip: string = document.getElementById('ip').value.trim()
  //@ts-ignore
  let domain: string = document.getElementById('domain').value.trim()
  //@ts-ignore
  let at: number = parseInt(document.getElementById('at').value)
  if (at == 2) {
    //忽略就全部忽略
    ip = ""
  }
  
  fetchPost('/api/access-control/update', {accessType: at, ip: ip, domain: domain}, 'no-cache', (rspData) => {
    console.log(rspData)
  })
}

function initControl(query: any) {
  //@ts-ignore
  document.getElementById('denyTable').innerHTML = ''
  fetchPost('/api/access-deny/get', {}, 'no-cache', (rspData) => {
    renderDenyTable(rspData)
  })

  //@ts-ignore
  document.getElementById('controlTable').innerHTML = ''
  fetchPost('/api/access-control/get', {}, 'no-cache', (rspData) => {
    renderControlTable(rspData)
  })

  //@ts-ignore
  document.getElementById('denySubmit').addEventListener('click', denySubmit)
  
  //@ts-ignore
  document.getElementById('controlSubmit').addEventListener('click', controlSubmit)
}

export function init() {
  if (window.location.href.startsWith('file:')) {
    server = 'http://127.0.0.1:8123'
  }

  let pathname = window.location.pathname
  let arr = pathname.split('/')
  pathname = arr[arr.length-1]
  let query = parseQuery(window.location.search)
  switch (pathname) {
    case '':
    case 'index.html':
      initIndex(query)
      break
    case 'control.html':
      initControl(query)
      break
    default:
      console.log('wrong pathname', pathname, window.location.pathname)
      break
  }
}

document.addEventListener('DOMContentLoaded', function () {
  init()
})