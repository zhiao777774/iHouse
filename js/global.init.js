const sensorData = {};
let userAccount = undefined;

(function (global, document, $) {
    'use strict';

    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') {
            initializeNavigationBar();
            initializeSensorData();
            displayLogInPanel();

            socket.on('pirSensor', function (data) {
                const detected = Boolean(data);
                $('#alert-container').fadeIn('slow')
                    .text(detected ? '有人靠近!' : '人已消失');
                setTimeout(() => $('#alert-container').fadeOut('slow'), 3000);
            })
        }
    });

    function displayLogInPanel() {
        const $logInPanel = $('#logIn-container.group-modal'),
            $blocker = $('.blocker');

        if (readCookie('doNotShowLogInPanel') === 'true') {
            eraseCookie('doNotShowLogInPanel');
            $blocker.remove();
        }

        $logInPanel.html(`
            <div class="header">
                <div class="title">成員登入</div>
            </div>
            <div class="body">
                <div class="form-group">
                    <label for="input-account">帳號</label>
                    <input type="text" id="input-account" class="form-control" placeholder="請輸入帳號">
                    <small class="warning" style="display: none;">帳號或密碼錯誤</small>
                </div>
                <div class="form-group">
                    <label for="input-password">密碼</label>
                    <input type="password" id="input-password" class="form-control" placeholder="請輸入密碼">
                    <small class="warning" style="display: none;">帳號或密碼錯誤</small>
                </div>
                <div class="form-group form-check">
                    <input type="checkbox" class="form-check-input" id="input-doNotShowAgain">
                    <label class="form-check-label" for="input-doNotShowAgain">下次自動登入</label>
                </div>
                <button type="submit" class="btn btn-sm btn-danger">登入</button>
            </div>
        `);

        $blocker.show();
        $logInPanel.css('display', 'inline-block');

        $logInPanel.find('button[type="submit"]').on('click', (e) => {
            const account = String($logInPanel.find('#input-account').val()),
                password = String($logInPanel.find('#input-password').val());

            $logInPanel.find('.warning').hide();
            if (!account || !password) {
                $logInPanel.find('.warning')
                    .text('帳號與密碼欄位不可為空').show();
            } else {
                FirebaseDB.ref('house-web-accessible-account')
                    .where('account', '==', account)
                    .where('password', '==', password)
                    .get().then((accounts) => {
                        if (accounts.size > 0) {
                            const doNotShowAgain = $logInPanel.find('#input-doNotShowAgain').prop('checked');
                            createCookie('doNotShowLogInPanel', doNotShowAgain);
                            $blocker.remove();

                            determineAccountAuthority(accounts);
                            saveLogInRecord(account);
                        } else {
                            $logInPanel.find('.warning')
                                .text('帳號或密碼錯誤').show();
                        }
                    });
            }
        });

        $('#input-account').keyup(_inputRestrictions);
        $('#input-password').keyup(_inputRestrictions);

        function _inputRestrictions(e) {
            if (e.keyCode === 13 || e.which === 13) {
                e.preventDefault();
                $logInPanel.find('button[type="submit"]')
                    .focus().click();
            }

            e = e.target;
            if (!/^\w+$/.test(e.value)) {
                $(e).val(/^\w+/.exec($(e).val()));
            } else if (e.value.length > 12) {
                $(e).val(e.value.substring(0, e.value.length - 1));
            }
            return false;
        }
    }

    async function initializeSensorData() {
        const modules = ['led', 'tempHumid', 'rgbLed', 'door',
            'fan', 'airCon', 'lightRing', 'tv', 'audio'];
        const data = {};
        modules.forEach((module) => {
            data[module] = FirebaseDB.get('house-sensor', module);
        });

        await data.led.then((led) => {
            sensorData.led1 = led.led1;
            sensorData.led2 = led.led2;
        });

        await data.tempHumid.then((tempHumid) => {
            sensorData.temp = '溫度: ' + tempHumid.temp + '°C';
            sensorData.humid = '濕度: ' + tempHumid.humid + '%';
        });

        await data.rgbLed.then((rgbLed) => {
            sensorData.rgbLed = `rgb(${rgbLed.red}, ${rgbLed.green}, ${rgbLed.blue})`;
        });

        await data.door.then((door) => {
            sensorData.door = door.isOpen;
        });

        await data.fan.then((fan) => {
            sensorData.fan = fan.isOpen;
        });

        await data.airCon.then((airCon) => {
            sensorData.airCon = airCon.isOpen;
        });

        await data.lightRing.then((lightRing) => {
            const styles = ['關閉', '漸變循環', '劇院追逐', '劇院追逐 - 彩虹色',
                '彩虹', '彩虹圈圈', '閃光', '流光', '賽隆人', '發泡'];
            sensorData.lightRing = styles[lightRing.type];
        });

        await data.tv.then((tv) => {
            sensorData.tv = tv.isOpen;
        });

        await data.audio.then((audio) => {
            sensorData.audio = audio.isOpen;
        });

        $('#btnDisplayMonitor').click();
    }

    function initializeNavigationBar() {
        const $ul = $('nav div.sidebar-sticky ul.nav.flex-column');
        const components = [{
            icon: 'stats',
            title: '溫溼度歷史資料'
        }, {
            icon: 'off',
            title: '控制板'
        }, {
            icon: 'credit-card',
            title: '感應卡管理'
        }, {
            icon: 'pencil',
            title: '系統使用紀錄'
        }];

        components.forEach(({ icon, title }) => {
            $ul.append(`
            <li class="nav-item">
                <span class="nav-link">
                    <span class="glyphicon glyphicon-${icon}"></span>
                    <span style="margin-left: 5px; font-weight: bold;">${title}</span>
                </span>
            </li>`);
        });

        $ul.children('li').on('click', ({ target }) => {
            $ul.children().css('color', 'black');
            const $target = (function (t) {
                if ($(t).is('span.nav-link'))
                    return $(t).parent();
                else if ($(t).is('span'))
                    return $(t).parent().parent();
                return $(t);
            })(target);

            $ul.children(`li:nth-child(${$target.index() + 1})`).css('color', 'red');

            let title = $target.text().trim();
            changePage(title);
        });

        $ul.children('li').hover(({ target }) => {
            $ul.children('li span').css('color', 'rgba(245, 208, 22, .7)');
        }, ({ target }) => {
            $ul.children('li span').css('color', 'black');
        });

        $ul.children(':nth-child(2)').click();
    }

    function changePage(title) {
        if (preRenderer) {
            console.log(preRenderer.rendererID);
            rendererList[preRenderer.rendererID].empty();
            rendererList[preRenderer.rendererID] = undefined;
        }

        let renderer;
        switch (title) {
            case '溫溼度歷史資料':
                renderer = new Renderer.Dashboard();
                break;
            case '控制板':
                renderer = new Renderer.Controlboard();
                break;
            case '感應卡管理':
                renderer = new Renderer.AccessManagement();
                break;
            case '系統使用紀錄':
                renderer = new Renderer.UsageRecord();
                break;
            default:
                return;
        }

        renderer.rendering();
        rendererList[renderer.rendererID] = preRenderer = renderer;
        console.log(rendererList);
    }

    function determineAccountAuthority(accounts) {
        accounts.forEach((account) => {
            const data = account.data();
            const isAdminstrator = data.authority === 'adminstrator';
            $('#float-menu h6')
                .text(`您目前以 ${data.account} 帳號登入${isAdminstrator ? '(管理員)' : ''}`);

            if (isAdminstrator) {
                $('#float-menu button').show();
                $('main').append(`
                    <div class="blocker">
                        <div id="member-management-container" class="group-modal">
                            <div class="header">
                                <div class="title"></div>
                                <span class="closer">✖</span>
                            </div>
                            <div class="body">
                                <div class="form-group">
                                    <label for="input-account">帳號</label>
                                    <input type="text" id="input-account" class="form-control" placeholder="請輸入帳號">
                                    <small class="warning" style="display: none;">帳號已存在</small>
                                </div>
                                <div class="form-group">
                                    <label for="input-password">密碼</label>
                                    <input type="password" id="input-password" class="form-control" placeholder="請輸入密碼">
                                </div>
                                <button type="submit" class="btn btn-sm btn-danger"></button>
                            </div>
                        </div>
                    </div>
                `);

                const $managementPanel = $('#member-management-container.group-modal'),
                    $blocker = $('.blocker');

                $managementPanel.find('.closer')
                    .click(() => $blocker.hide());
                $managementPanel.find('#input-account').keyup(_inputRestrictions);
                $managementPanel.find('#input-password').keyup(_inputRestrictions);

                function _inputRestrictions(e) {
                    if (e.keyCode === 13 || e.which === 13) {
                        e.preventDefault();
                        $managementPanel.find('button[type="submit"]')
                            .focus().click();
                    }

                    e = e.target;
                    if (!/^\w+$/.test(e.value)) {
                        $(e).val(/^\w+/.exec($(e).val()));
                    } else if (e.value.length > 12) {
                        $(e).val(e.value.substring(0, e.value.length - 1));
                    }
                    return false;
                }

                $('#btnAdditionMember').click(() => {
                    $blocker.show();
                    $managementPanel.css('display', 'inline-block');
                    $managementPanel.find('div.form-group:nth-of-type(2)').show();
                    $managementPanel.find('.title').text('新增成員');
                    $managementPanel.find('.warning').hide();
                    $managementPanel.find('#input-account').val('');
                    $managementPanel.find('#input-password').val('');
                    $managementPanel.find('button[type="submit"]').attr('id', 'addMember').unbind();
                    $managementPanel.find('#addMember').click(() => {
                        const account = String($managementPanel.find('#input-account').val()),
                            password = String($managementPanel.find('#input-password').val());

                        $managementPanel.find('.warning').hide();
                        if (!account || !password) {
                            $managementPanel.find('.warning')
                                .text('帳號與密碼欄位不可為空').show();
                        } else {
                            FirebaseDB.ref('house-web-accessible-account')
                                .where('account', '==', account)
                                .get().then((accounts) => {
                                    if (accounts.size > 0) {
                                        $managementPanel.find('.warning')
                                            .text('帳號已存在').show();
                                    } else {
                                        FirebaseDB.add('house-web-accessible-account', {
                                            account: account,
                                            password: password,
                                            authority: 'member'
                                        }).then(() => {
                                            alert(`新增帳號${account}成功`);
                                            $managementPanel.find('#input-account').val('');
                                            $managementPanel.find('#input-password').val('');

                                            saveUsageRecord(`新增帳號${account}`);
                                        });
                                    }
                                });
                        }
                    }).text('新增');
                });
                $('#btnRemoveMember').click(() => {
                    $blocker.show();
                    $managementPanel.css('display', 'inline-block');
                    $managementPanel.find('div.form-group:nth-of-type(2)').hide();
                    $managementPanel.find('.title').text('刪除成員');
                    $managementPanel.find('.warning').hide();
                    $managementPanel.find('#input-account').val('');
                    $managementPanel.find('#input-password').val('');
                    $managementPanel.find('button[type="submit"]').attr('id', 'removeMember').unbind();
                    $managementPanel.find('#removeMember').click(() => {
                        const account = String($managementPanel.find('#input-account').val());

                        $managementPanel.find('.warning').hide();
                        if (!account) {
                            $managementPanel.find('.warning')
                                .text('帳號欄位不可為空').show();
                        } else if (userAccount === account) {
                            $managementPanel.find('.warning')
                                .text('帳號欄位不可填寫自己帳號').show();
                        } else {
                            FirebaseDB.ref('house-web-accessible-account')
                                .where('account', '==', account)
                                .get().then((accounts) => {
                                    if (accounts.size > 0) {
                                        accounts.forEach((ac) => {
                                            ac.ref.delete().then(() => {
                                                alert(`刪除帳號${account}成功`);
                                                $managementPanel.find('#input-account').val('');
                                                $managementPanel.find('#input-password').val('');

                                                saveUsageRecord(`刪除帳號${account}`);
                                            });
                                        });
                                    } else {
                                        $managementPanel.find('.warning')
                                            .text('帳號不存在').show();
                                    }
                                });
                        }
                    }).text('刪除');
                });
            } else {
                $('#float-menu button').remove();
            }
        });
    }

    function saveLogInRecord(account) {
        userAccount = account;
        const collection = 'house-web-record',
            doc = 'logIn-record';

        FirebaseDB.get(collection, doc).then((doc) => {
            const records = doc.records;
            if (records.length >= 50) {
                FirebaseDB.update('house-web-record', 'logIn-record', {
                    records: FirebaseDB.arrayRemove(records[0])
                });
            }
        });

        const date = new Date();
        FirebaseDB.update(collection, doc, {
            records: FirebaseDB.arrayUnion({
                date: date.getFullDate() + ' ' + date.getFullTime(),
                account: account
            })
        });
    }

    $(function () {
        Date.prototype.getTWDFullDate = function (separator) {
            separator = !$.isArray(separator) ?
                new Array(3) : separator;

            for (let i = 0; i < 2; i++) {
                separator[i] = separator[i] || '/';
            }

            return (this.getFullYear() - 1911) + separator[0] +
                (this.getMonth() + 1) + separator[1] +
                (this.getDate());
        };

        Date.prototype.getFullDate = function (separator) {
            separator = !$.isArray(separator) ?
                new Array(3) : separator;

            for (let i = 0; i < 3; i++) {
                separator[i] = separator[i] || '/';
            }

            return this.getFullYear() + separator[0] +
                (this.getMonth() + 1) + separator[1] +
                (this.getDate());
        };

        Date.prototype.getFullTime = function () {
            let o = {
                h: this.getHours().toString(),
                m: this.getMinutes().toString(),
                s: this.getSeconds().toString(),
            };
            let format = (ele) => (ele.length === 1 ? '0' : '') + ele;

            return format(o.h) + ':' + format(o.m) + ':' + format(o.s);
        };

        global.createCookie = (name, value, days) => {
            let expires = '';
            if (days) {
                let date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = '; expires=' + date.toString();
            }
            document.cookie = name + '=' + value + expires;
        };

        global.readCookie = (name) => {
            let cookies = document.cookie.split(';');

            for (let cookie of cookies) {
                let kvPair = cookie.split('=');
                if (kvPair.length === 2) {
                    let key = $.trim(kvPair[0]),
                        value = $.trim(kvPair[1]);

                    if (key === name) return value;
                }
            }

            return null;
        };

        global.eraseCookie = (name) =>
            createCookie(name, '', -1);

        $('#monitor-container').click(() => monitorHandler());
        $('#btnDisplayMonitor').click(() => monitorHandler());
        $('#btnTurnOffAll').click(() => {
            ['door', 'fan', 'airCon', 'tv', 'audio'].forEach((module) => {
                FirebaseDB.update('house-sensor', module, { isOpen: false });
            });
            FirebaseDB.update('house-sensor', 'led', { led1: 0, led2: 0 });
            FirebaseDB.update('house-sensor', 'lightRing', { type: 0 });

            saveUsageRecord('關閉全部設備');
        });
    });

})(window, document, jQuery);

function monitorHandler() {
    const $monitor = $('#monitor-container');
    const isDisplay = $monitor.height() === 280;

    $monitor.height(isDisplay ? 45 : 280);
    $('#btnDisplayMonitor').text((isDisplay ? '展開' : '收合') + '監控視窗');
    setMonitorText();
}

function setMonitorText() {
    $('#monitor-container').html(`
        <h6>居家設備即時監控視窗</h6>
        <hr>
        <ul id="sensor-data-list">
            <li style="color: ${sensorData.door ? 'green' : 'red'};">大門: ${sensorData.door ? '開啟' : '關閉'}</li>
            <li class="float-left" style="color: ${sensorData.led1 ? 'green' : 'red'};">LED1: ${sensorData.led1 ? '開啟' : '關閉'}</li>
            <li style="color: ${sensorData.led2 ? 'green' : 'red'};">LED2: ${sensorData.led2 ? '開啟' : '關閉'}</li>
            <li class="float-left" style="color: ${sensorData.airCon ? 'green' : 'red'};">冷氣: ${sensorData.airCon ? '開啟' : '關閉'}</li>
            <li style="color: ${sensorData.fan ? 'green' : 'red'};">風扇: ${sensorData.fan ? '開啟' : '關閉'}</li>
            <li class="float-left" style="color: ${sensorData.tv ? 'green' : 'red'};">電視: ${sensorData.tv ? '開啟' : '關閉'}</li>
            <li style="color: ${sensorData.audio ? 'green' : 'red'};">音響: ${sensorData.audio ? '開啟' : '關閉'}</li>
            <li style="color: ${sensorData.rgbLed};">RGB LED: <br>${sensorData.rgbLed}</li>
            <li class="float-left" style="color: rgb(255, 102, 102);">${sensorData.temp}</li>
            <li style="color: rgb(102, 178, 255);">${sensorData.humid}</li>
            <li style="color: #611674;">燈環: ${sensorData.lightRing}</li>
        </ul>    
    `);
}

function saveUsageRecord(description) {
    const collection = 'house-web-record',
        doc = 'usage-record';
    FirebaseDB.get(collection, doc).then((doc) => {
        const records = doc.records;
        if (records.length >= 60) {
            FirebaseDB.update('house-web-record', 'usage-record', {
                records: FirebaseDB.arrayRemove(records[0])
            });
        }
    });

    const date = new Date();
    FirebaseDB.update(collection, doc, {
        records: FirebaseDB.arrayUnion({
            date: date.getFullDate() + ' ' + date.getFullTime(),
            account: userAccount,
            description: description
        })
    });
}