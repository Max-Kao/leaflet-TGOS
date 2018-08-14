/*
* leaflet-tgos v1.0.0 , a leaflet plugin that enables the use of TGOS Map tiles.
*/
L.TGOS = L.Class.extend({
    initialize: function(type, options) {
        L.setOptions(this, options);

        this.options.type = type;
    },
    onAdd: function(map, insertAtTheBottom) {
        this._map = map;
        this._insertAtTheBottom = insertAtTheBottom;
        this.options = map.options;
        if(!map.options.center)
            this.options.center = { lat: map._initialCenter.lat, lng: map._initialCenter.lng };
        if(!map.options.zoom)
            this.options.zoom = map._zoom;
        if(!map.options.minZoom) {
            map.options.minZoom = 0;
            this.options.minZoom = 0;
        } else if(typeof map.options.minZoom !== 'number') {
            throw new Error('minZoom must be a number');
        } else if(typeof map.options.minZoom === 'number' && (map.options.minZoom < 0 || map.options.minZoom > 19)) {
            throw new Error('minZoom must be between zero and nineteen');
        }
        if(!map.options.maxZoom) {
            map.options.maxZoom = 19;
            this.options.maxZoom = 19;
        } else if(typeof map.options.maxZoom !== 'number') {
            throw new Error('maxZoom must be a number');
        } else if(typeof map.options.maxZoom === 'number' && (map.options.maxZoom < 0 || map.options.maxZoom > 19)) {
            throw new Error('minZoom must be between zero and nineteen');
        }
        if(map.options.maxZoom < map.options.minZoom) {
            throw new Error('maxZoom must be more than minZoom');
        }

        // create a container div for tiles
        this._initContainer();
        this._initMapObject();

        // set up events
        map.on('viewreset', this._resetCallback, this);

        this._limitedUpdate = L.Util.limitExecByInterval(this._update, 10, this);
        map.on('move', this._update, this);
        map.on('zoomend', this._zoom, this);

        this._reset();
        this._update();
    },
    onRemove: function() {
        this._map._container.removeChild(this._container);
        //this._container = null;

        TGOS.TGEvent.removeListener(this._wheel_zoom);

        this._map.off('viewreset', this._resetCallback, this);
        this._map.off('move', this._update, this);
        this._map.off('zoomend', this._zoom, this);
    },
    getAttribution: function() {
        return this.options.attribution;
    },
    _initContainer: function() {
        var tilePane = this._map._container;
        first = tilePane.firstChild;

        if(!this._container) {
            this._container = L.DomUtil.create('div', 'leaflet-tgos-layer leaflet-top leaflet-left');
            this._container.id = "_GMapContainer";
        }

        if(true) {
            tilePane.insertBefore(this._container, first);

            // this.setOpacity(this.options.opacity);
            var size = this._map.getSize();
            this._container.style.width = size.x + 'px';
            this._container.style.height = size.y + 'px';
            this._container.style.zIndex = 0;
        }
    },
    _initMapObject: function() {
        var pMap = new TGOS.TGOnlineMap(this._container, TGOS.TGCoordSys.EPSG3857);

        MapOptions = {
            backgroundColor: "#CCCCCC",  //backgroundColor(設定地圖背景顏色)
            disableDefaultUI: true,  //disableDefaultUI(是否關閉所有地圖物件)
            maxZoom: this.options.maxZoom,
            minZoom: this.options.minZoom,
            scrollwheel: true,  //scrollwheel(是否允許使用者使用滑鼠滾輪縮放地圖)
            mapTypeControl: false,  //mapTypeControl(是否開啟地圖類型控制項)
            mapTypeControlOptions: {  //mapTypeControlOptions(指定提供的地圖類型)
                mapTypeIds: [
                    TGOS.TGMapTypeId[this.options.type],
                    TGOS.TGMapTypeId.TGOSMAP
                ],
                //mapTypeId(設定地圖控制項中欲顯示之底圖圖磚類型按鈕
                //上行範例只提供福衛混和地圖及福衛二號衛星影像兩類)
                //若不設定則預設顯示所有類型的底圖圖磚按鈕供使用者切換
                controlPosition: TGOS.TGControlPosition.RIGHT_TOP,
                //controlPosition(設定地圖類型控制項在地圖的位置)
                // mapTypeControlStyle: TGOS.TGMapTypeControlStyle.DEFAULT
                //mapTypeControlstyle(設定地圖類型控制項樣式)
                //(可設定參數有：DEFAULT / HORIZONTAL_BAR / DROPDOWN_MENU)
            },
            navigationControl: false,  //navigationControl(是否開啟縮放控制列)
            navigationControlOptions: { //navigationControlOptions(提供指定縮放控制列)
                controlPosition: TGOS.TGControlPosition.RIGHT_TOP,
                //controlPosition(設定縮放控制列在地圖的位置)
                navigationControlStyle: TGOS.TGNavigationControlStyle.SMALL
                //navigationControlStyle(設定縮放控制列樣式)
                //(可設定參數有：完整版 / 縮小版(DEFAULT / SMALL))
            },
            scaleControl: false,  //scaleControl(是否開啟比例尺控制項)
            scaleControlOptions: {  //scaleControlOptions(提供指定比例尺控制項)
                controlPosition: TGOS.TGControlPosition.LEFT_BOTTOM
                // controlPosition (設定比例尺控制項在地圖的位置)
            },
            draggable: true,  //draggable(設定地圖是否可被拖曳)
            keyboardShortcuts: false  //keyboardShortcuts(設定是否可用鍵盤控制地圖)
        };

        pMap.setOptions(MapOptions);
        pMap.setZoom(this.options.zoom);
        this._map.setZoom(this.options.zoom);

        if(Array.isArray(this.options.center))
            var _center = new TGOS.TGPoint(...this.options.center.reverse());
        else
            var _center = new TGOS.TGPoint(this.options.center.lng, this.options.center.lat);
        pMap.setCenter(_center);

        var that = this;
        this._wheel_zoom = function() {
            var zoom_wheel = pMap.getZoom();
            that._map.setZoom(zoom_wheel);
        };
        TGOS.TGEvent.addListener(pMap, 'zoom_changed', this._wheel_zoom);

        this._tgos = pMap;
    },
    _resetCallback: function(e) {
        this._reset(e.hard);
    },
    _reset: function() {
        this._initContainer();
    },
    _update: function() {
        this._resize();

        var center = this._map.getCenter();
        var _center = new TGOS.TGPoint(center.lng, center.lat);

        this._tgos.setCenter(_center);
        this._tgos.setZoom(this._map.getZoom());
    },
    _zoom: function() {
        var zoom = this._map.getZoom();
        this._tgos.setZoom(zoom);
    },
    _resize: function() {
        var size = this._map.getSize();
        if(this._container.style.width == size.x &&
            this._container.style.height == size.y)
            return;
        this._container.style.width = size.x + 'px';
        this._container.style.height = size.y + 'px';
        TGOS.TGEvent.trigger(this._tgos, "resize");
    }
});