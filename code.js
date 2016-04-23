/*global d3, L, ui*/

(function() {
    'use strict';

    var mouseLatLng;
    var geoJson;
    var jsonShape;

    var map = new L.Map("map", {center: [0, 0], zoom: 12});
    // map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();

    var mapboxAccessToken = 'pk.eyJ1IjoiZ29saWtlIiwiYSI6ImZlMGFlOTI5ZDBkN2YzMTFjNGJmMjBjODg0YTFhM2Q4In0.qzsLfoMQDQA-_pNVyk9xpg';

    L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=' + mapboxAccessToken, {
        id: 'lovely.fa44a7c9',
        attribution: '',
        detectRetina: false
    }).addTo(map);

    var projectPoint = function(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    };

    var transform = d3.geo.transform({point: projectPoint});
    var path = d3.geo.path().projection(transform);

    // Part of Oakland
    jsonShape = [[{"y": 37.812275,"x": -122.215175},{"y": 37.812903,"x": -122.21725},{"y": 37.816203,"x": -122.232228},{"y": 37.812275,"x": -122.215175}]];

    ui.jsonshape.value(JSON.stringify(jsonShape));

    var convertToGeoJson = function(jsonShape) {
        var a1 = [];
        jsonShape.forEach(function(l1) {
            var a2 = [];
            l1.forEach(function(l2) {
                a2.push([l2.x, l2.y]);
            });
            a1.push(a2);
        });

        a1.sort(function(a, b) {
            var aBounds = path.bounds({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [a]
                }
            });

            var bBounds = path.bounds({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [b]
                }
            });

            var aArea = Math.abs(aBounds[1][0] - aBounds[0][0]) * Math.abs(aBounds[1][1] - aBounds[0][1]);
            var bArea = Math.abs(bBounds[1][0] - bBounds[0][0]) * Math.abs(bBounds[1][1] - bBounds[0][1]);

            return bArea - aArea;
        });

        return {
            type: 'Polygon',
            coordinates: a1
        };
    };

    var geoJsonBounds = function(geoJson) {
        var max = {};
        var min = {};

        max.lat = d3.max(geoJson.coordinates, function(d) {
            return d3.max(d, function(d) { return d[1]; });
        });

        max.lng = d3.max(geoJson.coordinates, function(d) {
            return d3.max(d, function(d) { return d[0]; });
        });

        min.lat = d3.min(geoJson.coordinates, function(d) {
            return d3.min(d, function(d) { return d[1]; });
        });

        min.lng = d3.min(geoJson.coordinates, function(d) {
            return d3.min(d, function(d) { return d[0]; });
        });

        var sw = L.latLng(max.lat, min.lng);
        var ne = L.latLng(min.lat, max.lng);

        return L.latLngBounds(sw, ne);
    };

    geoJson = convertToGeoJson(jsonShape);
    map.fitBounds(geoJsonBounds(geoJson), {padding: [10, 10]});

    d3.select(ui.jsonshape.element).on('change', function() {
        geoJson = convertToGeoJson(JSON.parse(ui.jsonshape.value().split('\\').join('')));
        map.fitBounds(geoJsonBounds(geoJson), {padding: [10, 10]});
    });

    d3.select(ui.geojson.element).on('change', function() {
        geoJson = JSON.parse(ui.geojson.value().split("'").join('"'));
        map.fitBounds(geoJsonBounds(geoJson), {padding: [10, 10]});
    });

    var svg = d3.select(map.getPanes().overlayPane).append("svg");
    var g = svg.append("g").attr("class", "leaflet-zoom-hide");

    var layer = {
        polygons: g.append('g').attr('class', 'polygons'),
        borders: g.append('g').attr('class', 'borders'),
        handles: g.append('g').attr('class', 'handles')
    };

    var reset = function() {
        ui.geojson.value(JSON.stringify(geoJson));

        var tr = d3.select('#paths table').selectAll('tr')
            .data(geoJson.coordinates, function(d) { return d; });

        tr.enter().append('tr');
        tr.exit().remove();

        tr.attr('class', function(d, i) { return 'i' + i; });

        tr.selectAll('th').remove();
        tr.append('th')
            .text(function(d, i) { return 'path ' + i; });

        tr.selectAll('td').remove();
        tr.append('td')
            .text(function(d) { return d.length + ' points'; });
        tr.append('td').append('button')
            .text('reverse')
            .on('click', function(d) {
                d = d.reverse();
                reset();
            });
        tr.append('td').append('button')
            .attr('disabled', function() { if (geoJson.coordinates.length === 1) { return 'disabled'; } })
            .text('remove')
            .on('click', function() {
                if (geoJson.coordinates.length > 1) {
                    var i = +d3.select(this.parentNode.parentNode).attr('class').split('i').join('');
                    geoJson.coordinates.splice(i, 1);
                    map.fitBounds(geoJsonBounds(geoJson), {padding: [10, 10]});
                    reset();
                }
            });

        var bounds = path.bounds(geoJson);
        var topLeft = bounds[0];
        var bottomRight = bounds[1];

        topLeft[0] -= 200;
        topLeft[1] -= 200;

        bottomRight[0] += 200;
        bottomRight[1] += 200;

        svg.attr("width", bottomRight[0] - topLeft[0])
            .attr("height", bottomRight[1] - topLeft[1])
            .style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px");

        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

        if (geoJson) {
            var polygon = layer.polygons.selectAll('path')
                .data([{ type: 'Feature', geometry: geoJson }]);

            polygon.enter()
                .append('path')
                .attr('class', function(d, i) {
                    return 'i' + i;
                });

            polygon.exit().remove();

            polygon.attr('d', path);

            var features = [];
            geoJson.coordinates.forEach(function(d) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [d]
                    }
                });
            });

            var border = layer.borders.selectAll('path')
                .data(features);

            border.enter().append('path')
                .attr('class', function(d, i) { return 'i' + i; })
                .on('click', function(d, i) {
                    var lat = Math.round(mouseLatLng.lat * 1000000) / 1000000;
                    var lng = Math.round(mouseLatLng.lng * 1000000) / 1000000;

                    var closest = {
                        i: 0,
                        distance: 9999
                    };

                    geoJson.coordinates[i].forEach(function(element, index, array) {
                        if (index < array.length - 1) {

                            var point1 = map.latLngToLayerPoint(L.latLng(element[1], element[0]));
                            var point2 = map.latLngToLayerPoint(L.latLng(array[index + 1][1], array[index + 1][0]));
                            var point3 = map.latLngToLayerPoint(L.latLng(lat, lng));

                            var distance = L.LineUtil.pointToSegmentDistance(point3, point1, point2);

                            if (distance < closest.distance) {
                                closest.i = index;
                                closest.distance = distance;
                                closest.pointOnSegment = L.LineUtil.closestPointOnSegment(point3, point1, point2);
                            }
                        }
                    });

                    var latLng = map.layerPointToLatLng(closest.pointOnSegment);
                    geoJson.coordinates[i].splice(closest.i + 1, 0, [latLng.lng, latLng.lat]);

                    reset();
                });

            border.exit().remove();

            border.attr('d', path);

            var handles = layer.handles.selectAll('g')
                .data(geoJson.coordinates);

            handles.enter().append('g')
                .attr('class', function(d, i) { return 'i' + i; });

            handles.exit().remove();

            var dragging = false;

            var handle = handles.selectAll('circle')
                .data(function(d) { return d; });

            handle.enter().append('circle')
                .attr('r', 10)
                .on('click', function(d, i) {
                    if (!d3.event.altKey) { return; }
                    var parentIndex = +d3.select(this.parentNode).attr('class').split('i').join('');
                    if (i === 0 || i === geoJson.coordinates[parentIndex].length - 1) { return; }
                    geoJson.coordinates[parentIndex].splice(i, 1);
                    reset();
                })
                .on('mousedown', function() {
                    dragging = true;
                    map.dragging.disable();
                })
                .on('mouseup', function() {
                    map.dragging.enable();
                    dragging = false;
                })
                .on('mousemove', function(d, i) {
                    if (dragging) {
                        var lat = Math.round(mouseLatLng.lat * 1000000) / 1000000;
                        var lng = Math.round(mouseLatLng.lng * 1000000) / 1000000;
                        d[0] = lng;
                        d[1] = lat;

                        var parent = d3.select(this.parentNode);
                        var parentIndex = +parent.attr('class').split('i').join('');
                        var parentData = parent.datum();

                        if (i === 0) {
                            geoJson.coordinates[parentIndex][parentData.length - 1][0] = lng;
                            geoJson.coordinates[parentData][parentData.length - 1][1] = lat;
                        } else if (i === parentData.length - 1) {
                            geoJson.coordinates[parentIndex][0][0] = lng;
                            geoJson.coordinates[parentIndex][0][1] = lat;
                        }

                        reset();
                    }
                });

            handle.exit().remove();

            handle
                .attr('cx', function(d) { return map.latLngToLayerPoint([d[1], d[0]]).x; })
                .attr('cy', function(d) { return map.latLngToLayerPoint([d[1], d[0]]).y; });
        }
    };

    reset();

    map.on('viewreset', reset);
    map.on('mousemove', function(e) { mouseLatLng = e.latlng; });
})();
