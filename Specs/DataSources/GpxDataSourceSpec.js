/*global defineSuite*/
defineSuite(['DataSources/GpxDataSource',
             'Core/Cartesian3',
             'Core/Color',
             'Core/DeveloperError',
             'Core/RequestErrorEvent',
             'Core/RuntimeError',
             'DataSources/EntityCollection',
             'Core/loadXML',
             'Core/Event',
             'Core/Iso8601',
             'Core/JulianDate',
             'Core/Math'
            ], function(
                    GpxDataSource,
                    Cartesian3,
                    Color,
                    DeveloperError,
                    RequestErrorEvent,
                    RuntimeError,
                    EntityCollection,
                    loadXML,
                    Event,
                    Iso8601,
                    JulianDate,
                    CesiumMath) {
    "use strict";
    /*global jasmine,describe,xdescribe,it,xit,expect,beforeEach,afterEach,beforeAll,afterAll,spyOn,runs,waits,waitsFor*/

    var parser = new DOMParser();

    it('default constructor has expected values', function() {
        var dataSource = new GpxDataSource();
        expect(dataSource.name).toBeUndefined();
        expect(dataSource.clock).toBeUndefined();
        expect(dataSource.entities).toBeInstanceOf(EntityCollection);
        expect(dataSource.isLoading).toBe(false);
        expect(dataSource.changedEvent).toBeInstanceOf(Event);
        expect(dataSource.errorEvent).toBeInstanceOf(Event);
        expect(dataSource.loadingEvent).toBeInstanceOf(Event);
    });

    it('load throws with undefined GPX', function() {
        var dataSource = new GpxDataSource();
        expect(function() {
            dataSource.load(undefined);
        }).toThrowDeveloperError();
    });

    it('load works with a GPX URL', function() {
        var dataSource = new GpxDataSource();
        return dataSource.load('Data/GPX/simple.gpx').then(function(source) {
            expect(source).toBe(dataSource);
            expect(source.entities.values.length).toEqual(1);
        });
    });

    it('load rejects nonexistent URL', function() {
        return GpxDataSource.load('test.invalid').otherwise(function(e) {
            expect(e).toBeInstanceOf(RequestErrorEvent);
        });
    });

    it('load rejects loading non-GPX URL', function() {
        return GpxDataSource.load('Data/Images/Blue.png').otherwise(function(e) {
            expect(e).toBeInstanceOf(RuntimeError);
        });
    });

    it('sets DataSource creator and version from gpx', function() {
        var dataSource = new GpxDataSource();
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Test">\
            </gpx>';
        return dataSource.load(parser.parseFromString(gpx, "text/xml")).then(function() {
            expect(dataSource.version).toEqual('1.1');
            expect(dataSource.creator).toEqual('Test');
        });
    });

    it('sets DataSource name from metadata', function() {
        var dataSource = new GpxDataSource();
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Test">\
            <metadata>\
                <name>File Name</name>\
            </metadata>\
            </gpx>';
        return dataSource.load(parser.parseFromString(gpx, "text/xml")).then(function() {
            expect(dataSource.name).toEqual('File Name');
        });
    });

    it('sets DataSource name from sourceUri when not in file', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Test">\
            </gpx>';

        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml"), {
            sourceUri : 'NameFromUri.gpx'
        }).then(function(dataSource) {
            expect(dataSource.name).toEqual('NameFromUri.gpx');
        });
    });

    it('raises changed event when the name changes', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Test">\
            <metadata>\
                <name>NameInGpx</name>\
            </metadata>\
            </gpx>';

        var dataSource = new GpxDataSource();

        var spy = jasmine.createSpy('changedEvent');
        dataSource.changedEvent.addEventListener(spy);

        return dataSource.load(parser.parseFromString(gpx, "text/xml")).then(function() {
            //Initial load
            expect(spy).toHaveBeenCalledWith(dataSource);

            spy.calls.reset();
            return dataSource.load(parser.parseFromString(gpx, "text/xml")).then(function() {
                //Loading GPX with same name
                expect(spy).not.toHaveBeenCalled();

                gpx = gpx.replace('NameInGpx', 'newName');
                spy.calls.reset();
                return dataSource.load(parser.parseFromString(gpx, "text/xml")).then(function() {
                    //Loading KML with different name.
                    expect(spy).toHaveBeenCalledWith(dataSource);
                });
            });
        });
    });

    it('raises loadingEvent event at start and end of load', function() {
        var dataSource = new GpxDataSource();

        var spy = jasmine.createSpy('loadingEvent');
        dataSource.loadingEvent.addEventListener(spy);

        var promise = dataSource.load('Data/GPX/simple.gpx');
        expect(spy).toHaveBeenCalledWith(dataSource, true);
        spy.calls.reset();

        return promise.then(function() {
            expect(spy).toHaveBeenCalledWith(dataSource, false);
        });
    });

    it('Waypoint: sets name', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lat="1" lon="2">\
                    <name>Test</name>\
                </wpt>\
            </gpx>';

        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];
            expect(entity.name).toBe('Test');
            expect(entity.label).toBeDefined();
            expect(entity.label.text.getValue()).toBe('Test');
        });
    });

    it('Waypoint: throws with invalid coordinates', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lat="hello" lon="world">\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).otherwise(function(e) {
            expect(e).toBeInstanceOf(DeveloperError);
        });
    });

    it('Waypoint: throws when no coordinates are given', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).otherwise(function(e) {
            expect(e).toBeInstanceOf(DeveloperError);
        });
    });

    it('Waypoint: handles simple waypoint', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="38.737125" lat="-9.139242">\
                    <name>Position 1</name>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(1);
            expect(entities[0].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(38.737125, -9.139242, undefined));
            expect(entities[0].name).toEqual("Position 1");
        });
    });

    it('Waypoint: uses default billboard style', function() {
        var BILLBOARD_SIZE = 32;
        var DEFAULT_ICON = '../../../Build/Cesium/Assets/Textures/maki/marker.png';
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="38.737125" lat="-9.139242">\
                    <name>Position 1</name>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities[0].billboard.height.getValue()).toEqual(BILLBOARD_SIZE);
            expect(entities[0].billboard.width.getValue()).toEqual(BILLBOARD_SIZE);
            expect(entities[0].billboard.image.getValue()).toEqual(DEFAULT_ICON);
        });
    });

    it('Waypoint: handles simple waypoint with elevation', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <ele>3</ele>\
                    <name>Position 1</name>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(1);
            expect(entities[0].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(1, 2, 3));
        });
    });

    it('Waypoint: handles multiple waypoints', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <name>Position 1</name>\
                </wpt>\
                <wpt lon="3" lat="4">\
                    <name>Position 2</name>\
                </wpt>\
                <wpt lon="5" lat="6">\
                <name>Position 3</name>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(3);
            expect(entities[0].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(1, 2, undefined));
            expect(entities[1].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(3, 4, undefined));
            expect(entities[2].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(5, 6, undefined));
        });
    });

    it('Description: handles desc', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <desc>The Description</desc>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Description: The Description');
        });
    });

    it('Description: handles time', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <time>2015-08-17T00:06Z</time>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Time: 2015-08-17T00:06Z');
        });
    });

    it('Description: handles comment', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <cmt>The comment</cmt>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Comment: The comment');
        });
    });

    it('Description: handles source', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <src>The source</src>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Source: The source');
        });
    });

    it('Description: handles gps number', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <number>The number</number>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('GPS track/route number: The number');
        });
    });

    it('Description: handles type', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <type>The type</type>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Type: The type');
        });
    });

    it('Description: handles multiple fields', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <wpt lon="1" lat="2">\
                    <cmt>The comment</cmt>\
                    <desc>The description</desc>\
                    <type>The type</type>\
                </wpt>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Comment: The commentDescription: The descriptionType: The type');
        });
    });

    it('Description: handles route description', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <rte>\
                    <cmt>The comment</cmt>\
                    <desc>The description</desc>\
                    <type>The type</type>\
                    <rtept lon="1" lat="2">\
                        <ele>1</ele>\
                        <name>Position 1</name>\
                    </rtept>\
                    <rtept lon="3" lat="4">\
                        <ele>1</ele>\
                        <name>Position 2</name>\
                    </rtept>\
                    <rtept lon="5" lat="6">\
                        <ele>1</ele>\
                        <name>Position 3</name>\
                    </rtept>\
                    <rtept lon="7" lat="8">\
                        <ele>1</ele>\
                        <name>Position 4</name>\
                    </rtept>\
                </rte>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entity = dataSource.entities.values[0];

            var element = document.createElement('div');
            element.innerHTML = entity.description.getValue();

            var div = element.firstChild;
            expect(div.style['word-wrap']).toEqual('break-word');
            expect(div.style['background-color']).toEqual('rgb(255, 255, 255)');
            expect(div.style.color).toEqual('rgb(0, 0, 0)');
            expect(div.textContent).toEqual('Comment: The commentDescription: The descriptionType: The type');
        });
    });

    it('Route: handles simple route', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <rte>\
                    <name>Test Route</name>\
                    <rtept lon="1" lat="2">\
                        <ele>1</ele>\
                        <name>Position 1</name>\
                    </rtept>\
                    <rtept lon="3" lat="4">\
                        <ele>1</ele>\
                        <name>Position 2</name>\
                    </rtept>\
                    <rtept lon="5" lat="6">\
                        <ele>1</ele>\
                        <name>Position 3</name>\
                    </rtept>\
                    <rtept lon="7" lat="8">\
                        <ele>1</ele>\
                        <name>Position 4</name>\
                    </rtept>\
                </rte>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(5); //1 for the route and 4 routepoints
            expect(entities[1].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(1, 2, 1));
            expect(entities[2].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(3, 4, 1));
            expect(entities[3].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(5, 6, 1));
            expect(entities[4].position.getValue(Iso8601.MINIMUM_VALUE)).toEqual(Cartesian3.fromDegrees(7, 8, 1));
        });
    });

    it('Track: handles simple track', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <trk>\
                <name>Test Track</name>\
                    <trkseg>\
                        <trkpt lon="1" lat="2">\
                            <ele>1.0</ele>\
                            <name>Position 1</name>\
                        </trkpt>\
                        <trkpt lon="3" lat="4">\
                            <ele>1.0</ele>\
                            <name>Position 2</name>\
                            </trkpt>\
                    </trkseg>\
                </trk>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(1);

            var entity = entities[0];
            expect(entity.path).toBeUndefined();
            expect(entity.polyline).toBeDefined();

            var positions = entity.polyline.positions.getValue(Iso8601.MINIMUM_VALUE);
            expect(positions).toEqual([Cartesian3.fromDegrees(1, 2, 1), Cartesian3.fromDegrees(3, 4, 1)]);
        });
    });

    it('Track: uses default polyline style', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <trk>\
                <name>Test Track</name>\
                    <trkseg>\
                        <trkpt lon="1" lat="2">\
                            <ele>1.0</ele>\
                            <name>Position 1</name>\
                        </trkpt>\
                        <trkpt lon="3" lat="4">\
                            <ele>1.0</ele>\
                            <name>Position 2</name>\
                            </trkpt>\
                    </trkseg>\
                </trk>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(1);

            var entity = entities[0];
            expect(entity.path).toBeUndefined();
            expect(entity.polyline).toBeDefined();
            expect(entity.polyline.width.getValue()).toEqual(4);
            expect(entity.polyline.material.getValue()).toBeDefined();
            expect(entity.polyline.material.color.getValue()).toEqual(Color.RED);
            expect(entity.polyline.material.outlineWidth.getValue()).toEqual(2);
            expect(entity.polyline.material.outlineColor.getValue()).toEqual(Color.BLACK);
        });
    });

    it('Track: handles time-dynamic track', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <trk>\
                <name>Test Track</name>\
                    <trkseg>\
                        <trkpt lon="1" lat="2">\
                            <ele>1.0</ele>\
                            <name>Position 1</name>\
                            <time>2000-01-01T00:00:00Z</time>\
                        </trkpt>\
                        <trkpt lon="3" lat="4">\
                            <ele>1.0</ele>\
                            <name>Position 2</name>\
                            <time>2000-01-01T00:00:01Z</time>\
                        </trkpt>\
                        <trkpt lon="5" lat="6">\
                            <ele>1.0</ele>\
                            <name>Position 3</name>\
                            <time>2000-01-01T00:00:02Z</time>\
                        </trkpt>\
                    </trkseg>\
                </trk>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var time1 = JulianDate.fromIso8601('2000-01-01T00:00:00Z');
            var time2 = JulianDate.fromIso8601('2000-01-01T00:00:01Z');
            var time3 = JulianDate.fromIso8601('2000-01-01T00:00:02Z');

            var entity = dataSource.entities.values[0];
            expect(entity.position.getValue(time1)).toEqual(Cartesian3.fromDegrees(1, 2, 1));
            expect(entity.position.getValue(time2)).toEqual(Cartesian3.fromDegrees(3, 4, 1));
            expect(entity.position.getValue(time3)).toEqual(Cartesian3.fromDegrees(5, 6, 1));
            expect(entity.polyline).toBeUndefined();

            expect(entity.availability.start).toEqual(time1);
            expect(entity.availability.stop).toEqual(time3);
        });
    });

    it('Track: time-dynamic uses default path style', function() {
        var gpx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\
            <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="andre">\
                <trk>\
                <name>Test Track</name>\
                    <trkseg>\
                        <trkpt lon="1" lat="2">\
                            <ele>1.0</ele>\
                            <name>Position 1</name>\
                            <time>2000-01-01T00:00:00Z</time>\
                        </trkpt>\
                        <trkpt lon="3" lat="4">\
                            <ele>1.0</ele>\
                            <name>Position 2</name>\
                            <time>2000-01-01T00:00:01Z</time>\
                        </trkpt>\
                        <trkpt lon="5" lat="6">\
                            <ele>1.0</ele>\
                            <name>Position 3</name>\
                            <time>2000-01-01T00:00:02Z</time>\
                        </trkpt>\
                    </trkseg>\
                </trk>\
            </gpx>';
        return GpxDataSource.load(parser.parseFromString(gpx, "text/xml")).then(function(dataSource) {
            var entities = dataSource.entities.values;
            expect(entities.length).toEqual(1);

            var entity = entities[0];
            expect(entity.polyline).toBeUndefined();
            expect(entity.path).toBeDefined();
            expect(entity.path.leadTime.getValue()).toEqual(0);
            expect(entity.path.width.getValue()).toEqual(4);
            expect(entity.path.material.getValue()).toBeDefined();
            expect(entity.path.material.color.getValue()).toEqual(Color.RED);
            expect(entity.path.material.outlineWidth.getValue()).toEqual(2);
            expect(entity.path.material.outlineColor.getValue()).toEqual(Color.BLACK);
        });
    });
});
