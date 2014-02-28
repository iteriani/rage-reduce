
function generateBarChart(element, data, type, x_axis){
    var realData = [];
    var sum = data.reduce(function(prev, curr){ return prev + curr;});
    for(var i = 0; i < x_axis.length; i++){
        realData.push([x_axis[i], data[i]/sum]);
    }
    $(element).highcharts({
            chart: {
                type: 'pie',
                width: 300,
                height:300
            },
            title: {
                text: "Percentage of students' "+ type
            },
            subtitle: {
                text: 'Source: UCSD'
            },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
            yAxis: {
                min: 0,
                title: {
                    text: 'Students'
                }
            },
            plotOptions: {
                column: {
                    pointPadding: 0.2,
                    borderWidth: 0
                }
            },
            series: [{
                name : "Enrollments",
                data : realData
            }]
        });
   $(window).trigger( "resize" )
}