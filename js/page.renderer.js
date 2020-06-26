const rendererList = {};
let preRenderer = undefined,
    tempHumidChart = undefined,
    intervalID = undefined,
    timeoutID = undefined,
    currentPage = 1;

(function (global, $) {
    'use strict';

    const Renderer = {};
    global.Renderer = Renderer || {};

    function execRendering(panelTitle, html, callback, ...args) {
        $('#main-div > div').each((i, div) => $(div).hide());

        const $body = $('#main-div').children(`div#main-div-body-${panelTitle}`);
        if ($body.length > 0) {
            $body.show();
        } else {
            $('#main-div').append(`<div id="main-div-body-${panelTitle}"></div>`);
        }
        $('#main-div').children(`div#main-div-body-${panelTitle}`).html(html);

        if (callback && $.isFunction(callback)) {
            if (args.length > 0) callback.call(null, ...args);
            else callback.call();
        }
    }

    Renderer.Dashboard = function () {
        this.rendererID = 'Dashboard';
        const collection = 'historical-data';

        this.rendering = function () {
            execRendering(this.rendererID, `
                <h2 style="font-weight: bold;">溫溼度歷史資料</h2>
                <canvas id="canvas-tempHumid" height="125"></canvas>
            `);

            drawChart();
            FirebaseDB.onSnapshot(collection, 'tempHumid', () => drawChart());
        };

        this.empty = function () {
            tempHumidChart = undefined;
        };

        function drawChart() {
            getHistoricalData().then((data) => {
                tempHumidChart = undefined;
                $('#canvas-tempHumid').remove();
                $('#main-div-body-Dashboard')
                    .append('<canvas id="canvas-tempHumid" height="125"></canvas>');

                if (tempHumidChart) {
                    tempHumidChart.data.labels = data.date;
                    tempHumidChart.data.datasets[0].data = data.temps;
                    tempHumidChart.data.detasets[1].data = data.humids;
                    tempHumidChart.update();
                } else {
                    const ctx = document.getElementById('canvas-tempHumid').getContext('2d');
                    tempHumidChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: data.date,
                            datasets: [{
                                type: 'line',
                                label: '溫度',
                                data: data.temps,
                                yAxisID: 'temp',
                                borderColor: 'red',
                                fill: false,
                                pointRadius: 0,
                                lineTension: 0,
                                borderWidth: 2
                            }, {
                                type: 'line',
                                label: '濕度',
                                data: data.humids,
                                yAxisID: 'humid',
                                borderColor: 'blue',
                                fill: false,
                                pointRadius: 0,
                                lineTension: 0,
                                borderWidth: 2
                            }]
                        },
                        options: {
                            legend: {
                                display: true,
                                labels: {
                                    fontSize: 14,
                                    generateLabels: function (chart) {
                                        let data = chart.data;

                                        return data.datasets.map(function (data, index) {
                                            return {
                                                text: data.label + '　',
                                                fillStyle: 'white',
                                                strokeStyle: data.borderColor,
                                                lineWidth: 3,
                                                hidden: false,
                                                index: index
                                            };
                                        });
                                    }
                                }
                            },
                            tooltips: {
                                intersect: false,
                                mode: 'index',
                                callbacks: {
                                    label: function ({ datasetIndex, index }, { datasets }) {
                                        let currentValue = datasets[datasetIndex].data[index];
                                        return ' ' + datasets[datasetIndex].label + ': ' +
                                            currentValue + ['°C', '%'][datasetIndex];
                                    },
                                    labelColor: function ({ datasetIndex }, { data }) {
                                        return {
                                            borderColor: data.datasets[datasetIndex]
                                                .borderColor,
                                            backgroundColor: 'white'
                                        };
                                    },
                                }
                            },
                            scales: {
                                xAxes: [{
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true
                                    }
                                }],
                                yAxes: [{
                                    id: 'temp',
                                    distribution: 'series',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true,
                                        fontColor: 'red'
                                    },
                                    scaleLabel: {
                                        display: true,
                                        labelString: '溫度(°C)',
                                        fontColor: "red"
                                    }
                                }, {
                                    id: 'humid',
                                    distribution: 'series',
                                    position: 'right',
                                    ticks: {
                                        source: 'data',
                                        autoSkip: true,
                                        fontColor: 'blue'
                                    },
                                    scaleLabel: {
                                        display: true,
                                        labelString: '濕度(%)',
                                        fontColor: "blue"
                                    }
                                }]
                            }
                        },
                        plugins: [{
                            beforeInit: function (chart, options) {
                                chart.legend.afterFit = function () {
                                    this.height += 20;
                                };
                            }
                        }]
                    });
                }
            });
        }

        async function getHistoricalData() {
            const historicalData = {
                date: [],
                temps: [],
                humids: []
            };

            await FirebaseDB.get(collection, 'tempHumid').then((data) => {
                const temps = data && data.temps,
                    humids = data && data.humids;

                temps.forEach(({ date, value }) => {
                    historicalData.date.push(date);
                    historicalData.temps.push(value);
                });

                humids.forEach(({ date, value }) => {
                    historicalData.humids.push(value);
                });
            });

            return historicalData;
        }
    };

    Renderer.Controlboard = function () {
        this.rendererID = 'Controlboard';
        const collection = 'house-sensor';

        this.rendering = function () {
            execRendering(this.rendererID, `
                <ul id="controlboard-tab-container" class="nav nav-tabs">
                    <li class="nav-item">
                        <a href="#" class="nav-link active">第一頁</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">第二頁</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">第三頁</a>
                    </li>
                </ul>
                <div id="page-one">
                    <div id="led-div" class="box">
                        <h3>LED</h3>
                        <div id="bulbs"></div>
                    </div>
                    <div id="temphumid-div" class="box">
                        <h3>溫度、濕度</h3>
                        <h4 id="temp" class="font-msjh">溫度:</h4>
                        <h4 id="humid" class="font-msjh">濕度:</h4>
                    </div>
                    <div id="door-div" class="box">
                        <h3>大門</h3>
                        <div id="door" class="perspective">
                            <div class="thumb"></div>
                        </div>
                    </div>
                    <div id="rgb-div" class="box">
                        <h3>RGB燈</h3>
                        <div></div>
                    </div>
                </div>
                <div id="page-two" style="display: none;">
                    <div id="fan-div" class="box">
                        <h3>風扇</h3>
                        <div id="fan">
                            <div class="ceiling-fan horizontal left"></div>
                            <div class="ceiling-fan horizontal right"></div>  
                            <div class="ceiling-fan vertical rotated top"></div>
                            <div class="ceiling-fan vertical rotated bottom"></div>
                        </div>
                    </div>
                    <div id="airCon-div" class="box">
                        <h3>冷氣</h3>
                        <div id="airCon"></div>
                    </div>
                    <div id="lightRing-div" class="box">
                        <h3>燈環、燈條</h3>
                        <div class="form-inline">
                            <div>
                                <label for="select-lightRing-type" class="font-msjh my-1 mr-1">
                                    燈環樣式:
                                </label>
                                <select id="select-lightRing-type" class="custom-select my-1 mr-sm-2">
                                    <option value="0" selected>關閉</option>
                                    <option value="1">漸變循環</option>
                                    <option value="2">劇院追逐</option>
                                    <option value="3">劇院追逐 - 彩虹色</option>
                                    <option value="4">彩虹</option>
                                    <option value="5">彩虹圈圈</option>
                                    <option value="6">閃光</option>
                                    <option value="7">流光</option>
                                    <option value="8">賽隆人</option>
                                    <option value="9">發泡</option>
                                </select>
                                <button id="btnLightBarTrigger" class="btn btn-sm btn-secondary my-1 ml-2">燈條閃爍</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="page-three" style="display: none;">
                    <div id="tv-div" class="box">
                        <h3>電視</h3>
                        <div>
                            <h4 class="font-msjh">關閉</h4>
                            <img id="tv" src="./assets/tvClose.png" alt="電視">
                        </div>
                    </div>
                    <div id="audio-div" class="box">
                        <h3>音響</h3>
                        <div>
                            <h4 class="font-msjh">關閉</h4>
                            <img id="audio" src="./assets/audioClose.png" alt="音響">
                        </div>
                    </div>
                </div>
            `);

            createBulbs(2);
            createRgbDivision();
            createAirConditioner();
            initModuleChangeEvent();
            initModuleStatus();

            $('#controlboard-tab-container li').click(function () {
                $('#controlboard-tab-container li a').removeClass('active');
                $('#main-div-body-Controlboard > div').hide();
                $(this).children('a').addClass('active');

                currentPage = $(this).index() + 1;
                $('#main-div-body-Controlboard > ' +
                    `div:nth-of-type(${currentPage})`).show();
            });
            $('#controlboard-tab-container ' +
                `li:nth-of-type(${currentPage})`).click();

            if (!timeoutID) {
                timeoutID = setTimeout(() => {
                    _updateSensorData();
                    intervalID = setInterval(_updateSensorData, 3000);
                }, 3000);
            }

            function _updateSensorData() {
                sensorData.led1 = $('#bulbs svg:nth-of-type(1)')
                    .children('.filament').hasClass('light');
                sensorData.led2 = $('#bulbs svg:nth-of-type(2)')
                    .children('.filament').hasClass('light');
                sensorData.temp = $('#temp').text();
                sensorData.humid = $('#humid').text();
                sensorData.rgbLed = $('#rgb-color-monitor').css('background-color');
                sensorData.door = $('#door .thumb').hasClass('thumbOpened');
                sensorData.fan = $('#fan').hasClass('active');
                sensorData.airCon = $('#airCon').find('.airflow:nth-of-type(1)')
                    .css('display') !== 'none';
                sensorData.lightRing = $('#select-lightRing-type option:selected').text();
                sensorData.tv = $('#tv').hasClass('open');
                sensorData.audio = $('#audio').hasClass('open');

                setMonitorText();
            }
        };

        this.empty = function () {

        };

        function initModuleChangeEvent() {
            const callbacks = {
                led: function (doc) {
                    const data = doc.data();
                    const led1 = data && data.led1,
                        led2 = data && data.led2;

                    _changeStatus('1', led1);
                    _changeStatus('2', led2);
                    function _changeStatus(id, val) {
                        if (typeof (val) !== 'undefined') {
                            $(`#bulb-${id}`).children('.filament')
                                .toggleClass('light', val ? true : false);
                            $(`#bulb-${id}`).children('g').children('.cls-5')
                                .toggleClass('light', val ? true : false);
                        }
                    }
                },
                tempHumid: function (doc) {
                    const data = doc.data();
                    const temp = data && data.temp,
                        humid = data && data.humid;

                    $('#temp').text('溫度: ' + temp + '°C');
                    $('#humid').text('濕度: ' + humid + '%');
                },
                door: function (doc) {
                    const data = doc.data();
                    const isOpen = data && data.isOpen;

                    if (typeof (isOpen) !== 'undefined') {
                        $('#door .thumb').toggleClass('thumbOpened', isOpen);
                    }
                },
                rgbLed: function (doc) {
                    const data = doc.data();
                    const red = data && data.red,
                        green = data && data.green,
                        blue = data && data.blue;

                    const RGB = w3color(`rgb(${red}, ${green}, ${blue})`);

                    $('#rgb-r').data('slider').setValue(red);
                    $('#rgb-g').data('slider').setValue(green);
                    $('#rgb-b').data('slider').setValue(blue);
                    $('#rgb-color-monitor').css('background', RGB.toRgbString());
                },
                fan: function (doc) {
                    const data = doc.data();
                    const isOpen = data && data.isOpen;

                    if (typeof (isOpen) !== 'undefined') {
                        $('#fan').toggleClass('active', isOpen);
                    }
                },
                airCon: function (doc) {
                    const data = doc.data();
                    const isOpen = data && data.isOpen;

                    if (typeof (isOpen) !== 'undefined') {
                        $('#airCon').find('.airflow').toggle(isOpen);
                        $('#airCon > svg').height(isOpen ? '230px' : '');
                    }
                },
                lightRing: function (doc) {
                    const data = doc.data();
                    const type = data && data.type;

                    if (typeof (type) !== 'undefined') {
                        $('#select-lightRing-type ' +
                            `option:eq(${type})`)
                            .prop('selected', true);
                    }
                },
                tv: function (doc) {
                    const data = doc.data();
                    const isOpen = data && data.isOpen;

                    if (typeof (isOpen) !== 'undefined') {
                        $('#tv').toggleClass('open', isOpen)
                            .attr('src', './assets/tv' + `${isOpen ? 'Open' : 'Close'}.png`);
                        $('#tv').prev().css('color', isOpen ? 'green' : 'red')
                            .text(isOpen ? '開啟' : '關閉');
                    }
                },
                audio: function (doc) {
                    const data = doc.data();
                    const isOpen = data && data.isOpen;

                    if (typeof (isOpen) !== 'undefined') {
                        $('#audio').toggleClass('open', isOpen)
                            .attr('src', './assets/audio' + `${isOpen ? 'Open' : 'Close'}.png`);
                        $('#audio').prev().css('color', isOpen ? 'green' : 'red')
                            .text(isOpen ? '開啟' : '關閉');
                    }
                }
            };

            Object.keys(callbacks).forEach((module) => {
                const callback = callbacks[module];
                FirebaseDB.onSnapshot(collection, module, callback);
            });
        }

        function initModuleStatus() {
            const modules = ['led', 'tempHumid', 'rgbLed', 'door',
                'fan', 'airCon', 'lightRing', 'tv', 'audio'];
            const data = {};
            modules.forEach((module) => {
                data[module] = FirebaseDB.get(collection, module);
            });

            //LED燈--------------------------------------------------
            Object.values(data.led).forEach((state, i) => {
                if (state) $(`#bulb-${i + 1}`).click();
            });

            //溫濕度--------------------------------------------------
            const { temp, humid } = data.tempHumid;
            $('#temp').css('color', 'rgb(255, 102, 102)')
                .text('溫度: ' + temp + '°C');
            $('#humid').css('color', 'rgb(102, 178, 255)')
                .text('濕度: ' + humid + '%');

            //大門--------------------------------------------------
            $('#door').click(function () {
                const $thumb = $(this).children('.thumb');
                $thumb.toggleClass('thumbOpened');
                const isOpen = $thumb.hasClass('thumbOpened');

                FirebaseDB.update(collection, 'door', {
                    isOpen: isOpen
                });
                saveUsageRecord(`${isOpen ? '開' : '關'}門`);
            });
            if (data.door.isOpen) $('#door').click();

            //RGB燈--------------------------------------------------
            $('#rgb-r').data('slider').setValue(data.rgbLed.red);
            $('#rgb-g').data('slider').setValue(data.rgbLed.green);
            $('#rgb-b').data('slider').setValue(data.rgbLed.blue);

            //風扇--------------------------------------------------
            $('#fan').click(function () {
                $(this).toggleClass('active');
                const isOpen = $(this).hasClass('active');

                FirebaseDB.update(collection, 'fan', {
                    isOpen: isOpen
                });
                saveUsageRecord(`${isOpen ? '開' : '關'}風扇`);
            });
            if (data.fan.isOpen) $('#fan').click();

            //冷氣--------------------------------------------------
            if (data.airCon.isOpen === false) $('#airCon').click();

            //燈環--------------------------------------------------
            $('#select-lightRing-type').change(function () {
                const $selected = $(this).children('option:selected');

                FirebaseDB.update(collection, 'lightRing', {
                    type: Number($selected.val())
                });
                saveUsageRecord(`更改燈環狀態至${$selected.text()}`);
            });
            $('#select-lightRing-type ' +
                `option:eq(${data.lightRing.type})`)
                .prop('selected', true);

            //燈條--------------------------------------------------
            $('#btnLightBarTrigger').click(() => emitToServer('lightBarFlicker', {}));

            //電視--------------------------------------------------
            $('#tv').click(function () {
                $(this).toggleClass('open');
                const isOpen = $(this).hasClass('open');
                $(this).attr('src', './assets/tv' + `${isOpen ? 'Open' : 'Close'}.png`);
                $(this).prev().css('color', isOpen ? 'green' : 'red')
                    .text(isOpen ? '開啟' : '關閉');

                FirebaseDB.update(collection, 'tv', {
                    isOpen: isOpen
                });
                saveUsageRecord(`${isOpen ? '開' : '關'}電視`);
            });
            if (data.tv.isOpen) $('#tv').click();

            //音響--------------------------------------------------
            $('#audio').click(function () {
                $(this).toggleClass('open');
                const isOpen = $(this).hasClass('open');
                $(this).attr('src', './assets/audio' + `${isOpen ? 'Open' : 'Close'}.png`);
                $(this).prev().css('color', isOpen ? 'green' : 'red')
                    .text(isOpen ? '開啟' : '關閉');

                FirebaseDB.update(collection, 'audio', {
                    isOpen: isOpen
                });
                saveUsageRecord(`${isOpen ? '開' : '關'}音響`);
            });
            if (data.audio.isOpen) $('#audio').click();
        }

        function createAirConditioner() {
            const airConditioner = `
                <svg style="height: 230px;">
                    <rect width="300" height="100" rx="20" ry="20" fill="white" stroke="black" stroke-width="5" />
                    <circle cx="30" cy="30" r="10" fill="white" stroke="black" stroke-width="8"></circle>
                    <line x1="20" y1="60" x2="280" y2="60" stroke="black" stroke-width="6" />
                    <line x1="20" y1="80" x2="280" y2="80" stroke="black" stroke-width="6" />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M52 120 C10 130,70 140,40 150 S80 180,40 183 S90 210,30 215" />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M92 120 C50 130,110 140,80 150 S120 180,80 183 S130 210,70 215 " />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M132 120 C90 130,150 140,120 150 S160 180,120 183 S170 210,110 215 " />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M172 120 C130 130,190 140,160 150 S200 180,160 183 S210 210,150 215 " />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M212 120 C170 130,230 140,200 150 S240 180,200 183 S250 210,190 215 " />
                    <path class="airflow" stroke="black" stroke-width="5" fill="none" d="M252 120 C210 130,270 140,240 150 S280 180,240 183 S290 210,230 215 " />
                </svg>
            `;

            $('#airCon').html(airConditioner).click(function () {
                $(this).find('.airflow').toggle();
                const isOpen = !($(this).find('.airflow:nth-of-type(1)')
                    .css('display') === 'none');

                $('#airCon > svg').height(isOpen ? '230px' : '');

                FirebaseDB.update(collection, 'airCon', {
                    isOpen: isOpen
                });
                saveUsageRecord(`${isOpen ? '開' : '關'}冷氣`);
            });
        }

        function createRgbDivision() {
            $('#rgb-div div').html(`
                <p>
                    <span>R</span> 
                    <input type="text" id="rgb-r" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="r-control" data-slider-tooltip="hide" data-slider-handle="round" />
                </p>
                <p>
                    <span>G</span> 
                    <input type="text" id="rgb-g" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="g-control" data-slider-tooltip="hide" data-slider-handle="round" />
                </p>
                <p>
                    <span>B</span> 
                    <input type="text" id="rgb-b" data-slider-min="0" data-slider-max="255" data-slider-step="1" data-slider-value="128" data-slider-id="b-control" data-slider-tooltip="hide" data-slider-handle="round" />
                </p>
                <div id="rgb-color-monitor"></div>
            `);

            const r = $('#rgb-r').slider().show()
                .on('slide', _rgbSlide)
                .on('slideStop', _rgbChanged)
                .data('slider');
            const g = $('#rgb-g').slider().show()
                .on('slide', _rgbSlide)
                .on('slideStop', _rgbChanged)
                .data('slider');
            const b = $('#rgb-b').slider().show()
                .on('slide', _rgbSlide)
                .on('slideStop', _rgbChanged)
                .data('slider');

            $('#rgb-r').keyup(_inputChange);
            $('#rgb-g').keyup(_inputChange);
            $('#rgb-b').keyup(_inputChange);

            function _rgbSlide() {
                $('#rgb-color-monitor').css('background',
                    'rgb(' + r.getValue() + ', ' + g.getValue() + ', ' + b.getValue() + ')');
            }

            function _rgbChanged() {
                _rgbSlide();
                FirebaseDB.update(collection, 'rgbLed', {
                    red: r.getValue(),
                    green: g.getValue(),
                    blue: b.getValue()
                });
                saveUsageRecord(`更改RGB LED狀態至rgb(${r.getValue()}, ${g.getValue()}, ${b.getValue()})`);
            }

            function _inputChange(e) {
                e = e.target;

                if (e.value === '') {
                    $(e).val(0);
                } else if (e.value.length > 3) {
                    $(e).val(e.value.substr(1));
                } else if (!/^\d+$/.test(e.value)) {
                    $(e).val(/^\d+/.exec($(e).val()));
                } else if (e.value > 255) {
                    $(e).val(255);
                }

                $(e).data('slider').setValue($(e).val());
                _rgbChanged();

                return false;
            }
        }

        function createBulbs(n = 1) {
            const bulb = `
                <svg class="bulb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 154.72 276.77">
                    <path class="filament" d="M55.2 139.26l-.5 1.67 4.63 15.48.5-1.67-4.63-15.48zM85.62 123.84l-.5 1.67 4.63 15.48.49-1.67-4.62-15.48z" />
                    <path class="filament" d="M90.24 139.32l-.49 1.67 4.62 15.48.5-1.67-4.63-15.48zM68.11 123.84l-.5 1.67 4.62 15.48.5-1.67-4.62-15.48z" />
                    <path class="filament" d="M72.73 139.32l-.5 1.67 4.63 15.48.5-1.67-4.63-15.48zM58.85 154.8l.5 1.67 4.63-15.48-.5-1.67-4.63 15.48z" />
                    <path class="filament" d="M76.36 154.8l.5 1.67 4.63-15.48-.5-1.67-4.63 15.48zM63.48 139.32l.5 1.67 4.62-15.48-.49-1.67-4.63 15.48zM80.99 139.32l.5 1.67 4.62-15.48-.49-1.67-4.63 15.48zM93.88 154.8l.49 1.67L99 140.99l-.5-1.67-4.62 15.48z" />
                    <rect class="prong" width="2.36" height="59.85" x="53.05" y="138.65" rx="1.18" ry="1.18" />
                    <rect class="prong" width="2.36" height="58.81" x="98.3" y="138.65" rx="1.18" ry="1.18" />
                    <path class="cls-2" d="M41.05 193.11h71.61v46.03H41.05z" />
                    <ellipse class="cls-2" cx="76.85" cy="239.14" rx="35.81" ry="37.63" />
                    <rect class="cls-3" width="83" height="6.33" x="276.75" y="505.69" rx="3.17" ry="3.17" transform="rotate(13.12 1474.696 -687.534)" />
                    <rect class="cls-3" width="83" height="6.33" x="277.26" y="518.19" rx="3.17" ry="3.17" transform="rotate(13.12 1475.208 -675.038)" />
                    <rect class="cls-3" width="83" height="6.33" x="277.51" y="530.7" rx="3.17" ry="3.17" transform="rotate(13.12 1475.454 -662.554)" />
                    <rect class="cls-3" width="27.39" height="6.33" x="278.36" y="536.89" rx="3.17" ry="3.17" transform="rotate(13.12 1448.504 -656.327)" />
                    <rect class="cls-3" width="27.47" height="6.33" x="330.82" y="499.48" rx="3.17" ry="3.17" transform="rotate(13.12 1500.99 -693.73)" />
                    <g class="cls-4">
                        <rect class="cls-5" width="94.5" height="30.6" x="30.11" y="169.86" rx="12.26" ry="12.26" />
                        <circle class="cls-5" cx="77.36" cy="77.36" r="77.36" />
                        <path class="cls-5" d="M16.24 124.35c4 0 13.86 40.77 13.86 57.21h94.5c0-16.44 9.88-57.21 13.86-57.21H16.24z" />
                    </g>
                </svg>
            `;

            for (let i = 1; i <= n; i++) {
                $('#bulbs').append(bulb)
                    .children(`svg:nth-of-type(${i})`)
                    .attr('id', `bulb-${i}`)
                    .click(function () {
                        $(this).children('.filament').toggleClass('light');
                        $(this).children('g').children('.cls-5').toggleClass('light');

                        const data = {};
                        data['led' + i] = $(this).children('.filament').hasClass('light') ? 1 : 0;
                        FirebaseDB.update(collection, 'led', data);
                        saveUsageRecord(`${data['led' + i] ? '開啟' : '關閉'}LED${i}`);
                    });
            }
        }
    };

    Renderer.AccessManagement = function () {
        this.rendererID = 'AccessManagement';
        const collection = 'house-accessible-card';

        this.rendering = function () {
            execRendering(this.rendererID, `
                <h2 style="font-weight: bold;">感應卡管理</h2>
                <div id="card-management-div" class="input-group">
                    <input id="n-card" type="text" class="form-control" placeholder="請輸入卡號" aria-label="請輸入卡號">
                    <div class="input-group-append">
                        <button id="btnAddCard" class="btn btn-primary">新增</button>
                        <button id="btnDeleteCard" class="btn btn-secondary">刪除</button>
                    </div>
                </div>
                <hr>
                <div>
                    <div>
                        <h5 style="font-weight: bold;">可進入卡片</h5>
                        <table id="card-table" class="table scrollable">
                            <thead>   
                                <tr> 
                                    <th scope="col">#</th>
                                    <th scope="col">新增日期</th>
                                    <th scope="col">卡號</th>
                                </tr>
                            </thead>
                            <tbody class="scrollbar"></tbody>
                        </table>
                    </div>
                    <div>
                        <h5 style="font-weight: bold;">欲新增卡片</h5>
                        <table id="add-table" class="table scrollable">
                            <thead>   
                                <tr> 
                                    <th scope="col">#</th>
                                    <th scope="col">請求日期</th>
                                    <th scope="col">卡號</th>
                                    <th scope="col">新增</th>
                                    <th scope="col">取消</th>
                                </tr>
                            </thead>
                            <tbody class="scrollbar"></tbody>
                        </table>
                    </div>
                </div>
            `);

            _selectCards();
            FirebaseDB.onSnapshot(collection, () => _selectCards());
            FirebaseDB.onSnapshot('house-accessible-newCard', (docs) => {
                $('#add-table tbody').empty();

                let count = 1;
                docs.forEach((doc) => {
                    const data = doc.data();
                    const date = data && data.date,
                        val = data && data.value;

                    $('#add-table tbody').append(`
                        <tr>
                            <td>${count++}</td>
                            <td>${date}</td>
                            <td>${val}</td>
                            <td>
                                <button class="newCard-insert btn btn-sm btn-success">新增</button>
                            </td>
                            <td>
                                <button class="newCard-cancel btn btn-sm btn-danger">取消</button>
                            </td>
                        </tr>
                    `);
                });

                $('#add-table button.newCard-insert').click(({ target }) => {
                    const $tr = $(target).parent().parent();
                    const cardID = $tr.children('td:nth-of-type(3)').text();
                    const date = new Date();

                    FirebaseDB.set(collection, cardID, {
                        date: date.getFullDate() + ' ' + date.getFullTime(),
                        value: cardID
                    });
                    FirebaseDB.delete('house-accessible-newCard', cardID);
                    _selectCards();
                    saveUsageRecord('新增卡號' + cardID);
                    alert('新增卡號' + cardID + '成功');
                });

                $('#add-table button.newCard-cancel').click(({ target }) => {
                    const $tr = $(target).parent().parent();
                    const cardID = $tr.children('td:nth-of-type(3)').text();
                    FirebaseDB.delete('house-accessible-newCard', cardID);
                    saveUsageRecord('從待新增卡號表格取消卡號' + cardID);
                });
            });

            $('#btnAddCard').click(() => {
                let cardID = $('#n-card').val();
                if (!cardID) {
                    alert('請輸入卡號');
                    return;
                }

                const date = new Date();
                FirebaseDB.set(collection, cardID, {
                    date: date.getFullDate() + ' ' + date.getFullTime(),
                    value: cardID
                });
                FirebaseDB.delete('house-accessible-newCard', cardID);
                _selectCards();
                saveUsageRecord('新增卡號' + cardID);
                alert('新增卡號' + cardID + '成功');
            });

            $('#btnDeleteCard').click(() => {
                let cardID = $('#n-card').val();
                if (!cardID) {
                    alert('請輸入卡號');
                    return;
                }

                _selectCard(cardID).then((cards) => {
                    if (cards.size > 0) {
                        FirebaseDB.delete(collection, cardID);
                        _selectCards();
                        saveUsageRecord('刪除卡號' + cardID);
                        alert('刪除卡號' + cardID + '成功');
                    } else {
                        alert('卡號' + cardID + '不存在');
                    }
                });
            });

            function _selectCard(cardID) {
                return FirebaseDB.ref(collection)
                    .where('value', '==', cardID).get();
            }

            function _selectCards() {
                FirebaseDB.get(collection).then((data) => {
                    let count = 1;
                    $('#card-table tbody').empty();
                    data.forEach((d) => {
                        const { date, value } = d.data();
                        $('#card-table tbody').append(`
                            <tr>
                                <td scope="row">${count++}</td>
                                <td>${date}</td>
                                <td>${value}</td>
                            </tr>
                        `);
                    });
                });
            }
        };

        this.empty = function () {

        };
    };

    Renderer.UsageRecord = function () {
        this.rendererID = 'UsageRecord';
        const collection = 'house-web-record';

        this.rendering = function () {
            execRendering(this.rendererID, `
                <h2 style="font-weight: bold;">系統使用紀錄</h2>
                <div>
                    <div>
                        <h5 style="font-weight: bold;">登入紀錄</h5>
                        <table id="logIn-records-table" class="table scrollable">
                            <thead>   
                                <tr> 
                                    <th scope="col">#</th>
                                    <th scope="col">登入日期</th>
                                    <th scope="col">帳號</th>
                                </tr>
                            </thead>
                            <tbody class="scrollbar"></tbody>
                        </table>
                    </div>
                    <div>
                        <h5 style="font-weight: bold;">設備操作紀錄</h5>
                        <table id="sensor-records-table" class="table scrollable">
                            <thead>   
                                <tr> 
                                    <th scope="col">#</th>
                                    <th scope="col">操作日期</th>
                                    <th scope="col">帳號</th>
                                    <th scope="col">操作描述</th>
                                </tr>
                            </thead>
                            <tbody class="scrollbar"></tbody>
                        </table>
                    </div>
                </div>
            `);

            FirebaseDB.onSnapshot(collection, () => {
                FirebaseDB.get(collection, 'logIn-record').then((docs) => {
                    const records = docs.records;
                    let count = 1;
                    $('#logIn-records-table tbody').empty();
                    records.reverse().forEach((record) => {
                        const { date, account } = record;
                        $('#logIn-records-table tbody').append(`
                            <tr>
                                <td scope="row">${count++}</td>
                                <td>${date}</td>
                                <td>${account}</td>
                            </tr>
                        `);
                    });
                });

                FirebaseDB.get(collection, 'usage-record').then((docs) => {
                    const records = docs.records;
                    let count = 1;
                    $('#sensor-records-table tbody').empty();
                    records.reverse().forEach((record) => {
                        const { date, account, description } = record;
                        $('#sensor-records-table tbody').append(`
                            <tr>
                                <td scope="row">${count++}</td>
                                <td>${date}</td>
                                <td>${account}</td>
                                <td>${description}</td>
                            </tr>
                        `);
                    });
                });
            });
        };

        this.empty = function () {

        };
    };

})(window, jQuery);