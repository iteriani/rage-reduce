function AddPoint(series, arr){
    series.addPoint(arr, true,true);
}

function GenerateChart(element, _class){

        Highcharts.setOptions({
            global: {
                useUTC: false
            }
        });
    
 var URI = location.origin.replace(/^http/, 'ws');
 var socket = io.connect(URI);

        var chart;
        var series = null;
        $(element).highcharts({
            chart: {
                type: 'spline',
                width: 300,
                height:300,
                animation: Highcharts.svg, // don't animate in old IE
                marginRight: 10,
                events: {
                    load: function() {
    
                        // set up the updating of the chart each second
                        var init = 25;
                        series = this.series[0];
                        console.log(series);
 
                        socket.on('enrollment', function (data) {
                            console.log(data.id, _class.id);
                            if(parseInt(data.id) == _class.id){
                                var x = (new Date()).getTime(), // current time
                                    y = data.count;
                                AddPoint(series, [x,y]);
                            }
                        });
                    }
                }
            },
            title: {
                text: 'Enrollments'
            },
            xAxis: {
                type: 'datetime',
                tickPixelInterval: 150
            },
            yAxis: {
                title: {
                    text: 'Value'
                },
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: '#808080'
                }]
            },
            tooltip: {
                formatter: function() {
                        return '<b>'+ this.series.name +'</b><br/>'+
                        Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) +'<br/>'+
                        Highcharts.numberFormat(this.y, 2);
                }
            },
            legend: {
                enabled: false
            },
            exporting: {
                enabled: false
            },
            series: [{
                name: 'Random data',
                data: (function() {
                    // generate an array of random data
                    var data = [],
                        time = (new Date()).getTime(),
                        i;
                    data.push({
                        x: time -10 * 1000,
                        y: 0
                    });
                    for (i = -9; i <= 0; i++) {
                        data.push({
                            x: time + i * 1000,
                            y: _class.enrollment().length
                        });
                    }
                    return data;
                })()
            }]
        });
    $(window).trigger( "resize" )
}