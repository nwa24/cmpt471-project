//Followed tutorial of bl.ocks.org

function realTimeLineChart2() {
  var margin = {top: 20, right: 20, bottom: 20, left: 20},
      width = 800,
      height = 500,
      duration = 500,
      color = d3.schemeCategory10;

  function chart2(selection) {
    selection.each(function(data) {
      data = ["x"].map(function(c) {
        return {
          label: c,
          values: data.map(function(d) {
            return {time: +d.time, value: d[c]};
          })
        };
      });

      var t = d3.transition().duration(duration).ease(d3.easeLinear);
      var x = d3.scaleTime().rangeRound([0, width-margin.left-margin.right]);
      var y = d3.scaleLinear().rangeRound([height-margin.top-margin.bottom, 0]);
      var l = d3.scaleOrdinal(color);

      x.domain([
        d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.time; })}),
        new Date(new Date(d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.time; })})).getTime() - (duration*2))
      ]);

      y.domain([
        d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.value; })}),
        d3.max(data, function(c) { return d3.max(c.values, function(d) { return d.value; })})
      ]);

      l.domain(data.map(function(c) { return c.label; }));

      var line = d3.line().curve(d3.curveBasis).x(function(d) { return x(d.time); }).y(function(d) { return y(d.value); });

      var svg = d3.select(this).selectAll("svg").data([data]);
      var gEnter = svg.enter().append("svg").append("g");
      gEnter.append("g").attr("class", "axis x");
      gEnter.append("g").attr("class", "axis y");
      gEnter.append("defs").append("clipPath")
          .attr("id", "clip")
        .append("rect")
          .attr("width", width-margin.left-margin.right)
          .attr("height", height-margin.top-margin.bottom);
      gEnter.append("g")
          .attr("class", "lines")
          .attr("clip-path", "url(#clip)")
        .selectAll(".data").data(data).enter()
          .append("path")
            .attr("class", "data");



      svg = selection.select("svg");
      svg.attr('width', width).attr('height', height);
      var g = svg.select("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
      g.select("g.axis.x")
        .attr("transform", "translate(0," + (height-margin.bottom-margin.top) + ")")
        .transition(t)
        .call(d3.axisBottom(x).ticks(5));
      g.select("g.axis.y")
        .transition(t)
        .attr("class", "axis y")
        .call(d3.axisLeft(y));
      g.select("defs clipPath rect")
        .transition(t)
        .attr("width", width-margin.left-margin.right)
        .attr("height", height-margin.top-margin.right);
      g.selectAll("g path.data")
        .data(data)
        .style("stroke", function(d) { return l(d.label); })
        .style("stroke-width", 1)
        .style("fill", "none")
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .on("start", tick);

      function tick() {
        d3.select(this)
          .attr("d", function(d) { return line(d.values); })
          .attr("transform", null);

        var xMinLess = new Date(new Date(d3.min(data, function(c) { return d3.min(c.values, function(d) { return d.time; })})).getTime() - duration);
        d3.active(this)
            .attr("transform", "translate(" + x(xMinLess) + ",0)")
          .transition()
            .on("start", tick);
      }
    });
  }
  return chart2;
}