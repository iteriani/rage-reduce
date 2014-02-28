
function generateBarChart(element, data, type, x_axis){
    var realData = [];
    var sum = data.reduce(function(prev, curr){ return prev + curr;});
    for(var i = 0; i < x_axis.length; i++){
        realData.push([x_axis[i], data[i]/sum]);
    }
    $(element).highcharts({
            chart: {
                type: 'pie',
            },
            title: {
                text: "Percentage of students' "+ type
            },
            subtitle: {
                text: 'Source: UCSD'
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