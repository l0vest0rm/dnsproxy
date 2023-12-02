(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.lib = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
var server = '';
var data = undefined;
var ipNameMap = {
    '192.168.31.218': '小米笔记本',
    '192.168.31.251': '公司MBP',
    '192.168.31.162': '小米手机',
    '	192.168.31.241': 'ipad2018',
    '192.168.31.254': '华为P30'
};
function parseQuery(queryString) {
    var query = {};
    var pairs = (queryString[0] === '?' ? queryString.substring(1) : queryString).split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}
function fetchGet(path, cache, callback) {
    fetch("" + server + path, { cache: cache }).then(function (response) {
        return response.json();
    }).then(function (resp) {
        if (resp.code != 200) {
            console.log('fetchGet,not 200', resp);
            return;
        }
        callback(resp.data);
    }).catch(function (error) {
        console.log('fetchGet Failed', error);
    });
}
function fetchPost(path, body, cache, callback) {
    fetch("" + server + path, {
        method: 'POST',
        mode: 'cors',
        cache: cache,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(body) // body data type must match "Content-Type" header
    }).then(function (response) {
        return response.json();
    }).then(function (resp) {
        if (resp.code != 200) {
            console.log('transWords fetch,not 200', resp);
            return;
        }
        callback(resp.data);
    }).catch(function (error) {
        console.log('fetchPost Failed', error);
    });
}
function renderFilterIpSelect(ips) {
    var html = '<option value="">all</option>';
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = ips[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var ip = _step.value;

            var name = ip;
            if (ipNameMap[ip]) {
                name = ipNameMap[ip];
            }
            html += "<option value=\"" + ip + "\">" + name + "</option>";
        }
        //@ts-ignore
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    document.getElementById('filterIp').innerHTML = html;
}
function renderQuerylogTable(data, unique, freshIp) {
    var ipMap = {};
    var html = '';
    var domainMap = {};
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = data[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var item = _step2.value;

            if (unique && domainMap[item[3]]) {
                continue;
            }
            domainMap[item[3]] = 1;
            ipMap[item[2]] = 1;
            var date = new Date(parseInt(item[0]) * 1000);
            var at = item[1];
            switch (at) {
                case '0':
                    at = '忽略';
                    break;
                case '1':
                    at = '正常';
                    break;
                case '2':
                    at = '拦截';
                    break;
                default:
                    break;
            }
            var ip = item[2];
            if (ipNameMap[ip]) {
                ip += "(" + ipNameMap[ip] + ")";
            }
            html += "<tr>\n    <td>" + date.toLocaleString() + "</td>\n    <td>" + at + "</td>\n    <td>" + ip + "</td>\n    <td>" + item[3] + "</td>\n    <td>" + (item[4] ? item[4] : '') + "</td>\n    <td>\n      <select name=\"opt\" class=\"form-select\" domain=\"" + item[3] + "\">\n        <option value=\"\">\u4E0D\u52A8</option>\n        <option value=\"0\">\u5FFD\u7565</option>\n        <option value=\"1\">\u6B63\u5E38</option>\n        <option value=\"2\">\u62E6\u622A</option>\n      </select>\n    </td>\n    </tr>";
        }
        //@ts-ignore
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    document.getElementById('querylog').innerHTML = html;
    document.querySelectorAll("select[name='opt']").forEach(function (select) {
        console.log('select', select);
        select.addEventListener('change', optChange);
    });
    if (freshIp) {
        renderFilterIpSelect(Object.keys(ipMap));
    }
}
function filterIpChange() {
    //@ts-ignore
    var ip = document.getElementById('filterIp').value;
    if (ip == "") {
        renderQuerylogTable(data, true, false);
        return;
    }
    var items = [];
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = data[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var item = _step3.value;

            if (ip != item[2]) {
                continue;
            }
            items.push(item);
        }
    } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
            }
        } finally {
            if (_didIteratorError3) {
                throw _iteratorError3;
            }
        }
    }

    renderQuerylogTable(items, false, false);
}
function accessTypeChange() {
    //@ts-ignore
    var at = document.getElementById('accessType').value;
    if (at == "") {
        renderQuerylogTable(data, true, false);
        return;
    }
    var items = [];
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = data[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var item = _step4.value;

            if (at != item[1]) {
                continue;
            }
            items.push(item);
        }
    } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
            }
        } finally {
            if (_didIteratorError4) {
                throw _iteratorError4;
            }
        }
    }

    renderQuerylogTable(items, false, false);
}
function optChange(event) {
    var opt = event.target.value;
    if (opt == "") {
        return;
    }
    var at = parseInt(opt);
    //@ts-ignore
    var ip = document.getElementById('filterIp').value;
    if (at == 2) {
        //忽略就全部忽略
        ip = "";
    }
    var domain = event.target.getAttribute('domain');
    fetchPost('/api/access-control/update', { accessType: at, ip: ip, domain: domain }, 'no-cache', function (rspData) {
        console.log(rspData);
    });
}
function initDatesSelect() {
    var ts = Date.now() - 3600 * 8 * 1000;
    var html = '';
    for (var i = 0; i < 10; i++) {
        var date = new Date(ts);
        var str = "" + date.getFullYear() + (date.getMonth() + 1).toString().padStart(2, '0') + date.getDate().toString().padStart(2, '0');
        html += "<option value=\"" + str + "\">" + str + "</option>";
        ts -= 3600 * 24 * 1000;
    }
    //@ts-ignore
    document.getElementById('date').innerHTML = html;
}
function queryLog() {
    //@ts-ignore
    var date = document.getElementById('date').value;
    if (date == "") {
        return;
    }
    //@ts-ignore
    document.getElementById('querylog').innerHTML = '';
    fetchPost('/api/querylog/get', { date: date, ip: "", bufSize: 1024 * 1024 }, 'no-cache', function (rspData) {
        data = rspData;
        renderQuerylogTable(rspData, true, true);
    });
}
function initIndex(query) {
    initDatesSelect();
    queryLog();
    //@ts-ignore
    document.getElementById('date').addEventListener('change', queryLog);
    //@ts-ignore
    document.getElementById('filterIp').addEventListener('change', filterIpChange);
    //@ts-ignore
    document.getElementById('accessType').addEventListener('change', accessTypeChange);
}
function renderDenyTable(data) {
    var html = '';
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = data[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var item = _step5.value;

            var ip = item[0];
            if (ipNameMap[ip]) {
                ip += "(" + ipNameMap[ip] + ")";
            }
            html += "<tr>\n    <td>" + ip + "</td>\n    <td>" + item[1] + "</td>\n    </tr>";
        }
        //@ts-ignore
    } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
            }
        } finally {
            if (_didIteratorError5) {
                throw _iteratorError5;
            }
        }
    }

    document.getElementById('denyTable').innerHTML = html;
}
function renderControlTable(data) {
    data.sort(function (a, b) {
        return b[2] - a[2];
    });
    var html = '';
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
        for (var _iterator6 = data[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var item = _step6.value;

            var control = item[2];
            switch (control) {
                case '0':
                    control = '忽略';
                    break;
                case '1':
                    control = '正常';
                    break;
                case '2':
                    control = '拦截';
                    break;
                default:
                    break;
            }
            var ip = item[0];
            if (ipNameMap[ip]) {
                ip += "(" + ipNameMap[ip] + ")";
            }
            html += "<tr>\n    <td>" + ip + "</td>\n    <td>" + item[1] + "</td>\n    <td>" + control + "</td>\n    </tr>";
        }
        //@ts-ignore
    } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
            }
        } finally {
            if (_didIteratorError6) {
                throw _iteratorError6;
            }
        }
    }

    document.getElementById('controlTable').innerHTML = html;
}
function denySubmit(event) {
    //@ts-ignore
    var ip = document.getElementById('ip').value.trim();
    //@ts-ignore
    var at = parseInt(document.getElementById('deny').value);
    var deny = at == 1 ? true : false;
    fetchPost('/api/access-deny/update', { deny: deny, ip: ip }, 'no-cache', function (rspData) {
        console.log(rspData);
    });
}
function controlSubmit(event) {
    //@ts-ignore
    var ip = document.getElementById('ip').value.trim();
    //@ts-ignore
    var domain = document.getElementById('domain').value.trim();
    //@ts-ignore
    var at = parseInt(document.getElementById('at').value);
    if (at == 2) {
        //忽略就全部忽略
        ip = "";
    }
    fetchPost('/api/access-control/update', { accessType: at, ip: ip, domain: domain }, 'no-cache', function (rspData) {
        console.log(rspData);
    });
}
function initControl(query) {
    //@ts-ignore
    document.getElementById('denyTable').innerHTML = '';
    fetchPost('/api/access-deny/get', {}, 'no-cache', function (rspData) {
        renderDenyTable(rspData);
    });
    //@ts-ignore
    document.getElementById('controlTable').innerHTML = '';
    fetchPost('/api/access-control/get', {}, 'no-cache', function (rspData) {
        renderControlTable(rspData);
    });
    //@ts-ignore
    document.getElementById('denySubmit').addEventListener('click', denySubmit);
    //@ts-ignore
    document.getElementById('controlSubmit').addEventListener('click', controlSubmit);
}
function init() {
    if (window.location.href.startsWith('file:')) {
        server = 'http://127.0.0.1:8123';
    }
    var pathname = window.location.pathname;
    var arr = pathname.split('/');
    pathname = arr[arr.length - 1];
    var query = parseQuery(window.location.search);
    switch (pathname) {
        case '':
        case 'index.html':
            initIndex(query);
            break;
        case 'control.html':
            initControl(query);
            break;
        default:
            console.log('wrong pathname', pathname, window.location.pathname);
            break;
    }
}
exports.init = init;
document.addEventListener('DOMContentLoaded', function () {
    init();
});

},{}]},{},[1])(1)
});

//# sourceMappingURL=bundle.js.map
