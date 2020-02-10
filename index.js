const mapStyle = [{
  featureType: 'all',
  elementType: 'all',
  stylers: [{ visibility: 'off' }]
}, {
  featureType: 'water',
  elementType: 'labels',
  stylers: [{ visibility: 'off' }]
}, {
  featureType: 'road.highway',
  elementType: 'geometry',
  stylers: [{ visibility: 'on' }]
}, {
  featureType: 'transit.station.airport',
  elementType: 'all',
  stylers: [{ visibility: 'on' }]
}];
let map;
let statMax = Number.MAX_VALUE, statMin = Number.MIN_VALUE;

const chinaDict = {
  Anhui: "安徽",
  Beijing: "北京",
  Chongqing: "重庆",
  Fujian: "福建",
  Gansu: "甘肃",
  Guangdong: "广东",
  Guangxi: "广西",
  Guizhou: "贵州",
  Hainan: "海南",
  Hebei: "河北",
  Heilongjiang: "黑龙江",
  Henan: "河南",
  Hubei: "湖北",
  Hunan: "湖南",
  "Inner Mongolia": "内蒙古",
  Jiangsu: "江苏",
  Jiangxi: "江西",
  Jilin: "吉林",
  Liaoning: "辽宁",
  Macao: "澳门",
  Ningxia: "宁夏",
  Qinghai: "青海",
  Shaanxi: "陕西",
  Shandong: "山东",
  Shanxi: "山西",
  Shanghai: "上海",
  Sichuan: "四川",
  Taiwan: "台湾",
  Tianjin: "天津",
  Tibet: "西藏",
  Xianggang: "香港",
  Xinjiang: "新疆",
  Xizang: "西藏",
  Yunnan: "云南",
  Zhejiang: "浙江"
}

function initMap() {
  // load the map
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 40, lng: -100},
    zoom: 4,
    mapTypeId: 'hybrid',
    styles: mapStyle
  });

  // set up the style rules and events for google.maps.Data
  map.data.setStyle(styleFeature);
  map.data.addListener('mouseover', mouseInToRegion);
  map.data.addListener('mouseout', mouseOutOfRegion);

  // wire up the button
  let selectBox = document.getElementById('stat-variable');
  google.maps.event.addDomListener(selectBox, 'change', function() {
    clearStatData();
    setTimeout(() => { loadStatData(selectBox.options[selectBox.selectedIndex].value); }, 500);
  });

  // state polygons only need to be loaded once, do them now
  loadMapShapes();
}

/** Loads the state boundary polygons from a GeoJSON source. */
function loadMapShapes() {
  // load US state outline polygons from a GeoJson file
  // US States
  //map.data.loadGeoJson('https://storage.googleapis.com/mapsdevsite/json/states.js', { idPropertyName: 'NAME' });
  // Countries
  map.data.loadGeoJson('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json', { idPropertyName: 'name' });
  // US Cities
  map.data.loadGeoJson('https://raw.githubusercontent.com/codynegri/US-City-GeoJSON/master/us_cities.geojson', { idPropertyName: 'city'});
  // Chinese Provinces
  map.data.loadGeoJson('https://raw.githubusercontent.com/d3cn/data/master/json/geo/china/china-province.geojson', { idPropertyName: 'NAME'});


  // wait for the request to complete by listening for the first feature to be
  // added
  google.maps.event.addListenerOnce(map.data, 'addfeature', function() {
    google.maps.event.trigger(document.getElementById('stat-variable'),
        'change');
  });
}

/**
 * Loads the census data from a simulated API call to the US Census API.
 *
 * @param {string} variable
 */
function loadStatData(variable) {
  // load the requested variable from the census API (using local copies)
  var xhr = new XMLHttpRequest();
  xhr.open('GET', variable);
  xhr.onload = function() {
    var statData = JSON.parse(xhr.responseText);
    //statData.shift(); // the first row contains column names
    for (const row of statData.values) {
      let statVariable = parseFloat(row[row.length-1]);
      let stateName = row[0].split(',')[0];
      let countryName = row[1];

      if (countryName === "Mainland China") stateName = chinaDict[stateName];
      else if (countryName === "UK") countryName = "United Kingdom";

      // keep track of min and max values
      if (statVariable < statMin) {
        statMin = statVariable;
      }
      if (statVariable > statMax) {
        statMax = statVariable;
      }

      // update the existing row with the new data
      if (map.data.getFeatureById(stateName) !== undefined) {
        map.data
          .getFeatureById(stateName)
          .setProperty('stat_variable', statVariable);
      } else if (map.data.getFeatureById(countryName) !== undefined) {
      map.data
        .getFeatureById(countryName)
        .setProperty('stat_variable', statVariable);
      } else {
        console.log("could not find " + stateName +" "+ countryName);
      }
    };

    // update and display the legend
    document.getElementById('stat-min').textContent =
        statMin.toLocaleString();
    document.getElementById('stat-max').textContent =
        statMax.toLocaleString();
  };
  xhr.send();
}

/** Removes census data from each shape on the map and resets the UI. */
function clearStatData() {
  statMin = Number.MAX_VALUE;
  statMax = -Number.MAX_VALUE;
  map.data.forEach(function(row) {
    row.setProperty('stat_variable', undefined);
  });
  document.getElementById('data-box').style.display = 'none';
  document.getElementById('data-caret').style.display = 'none';
}

/**
 * Applies a gradient style based on the 'stat_variable' column.
 * This is the callback passed to data.setStyle() and is called for each row in
 * the data set.  Check out the docs for Data.StylingFunction.
 *
 * @param {google.maps.Data.Feature} feature
 */
function styleFeature(feature) {
  var low = [5, 69, 54];  // color of smallest datum
  var high = [151, 83, 34];   // color of largest datum

  // delta represents where the value sits between the min and max
  var delta = (feature.getProperty('stat_variable') - statMin) /
      (statMax - statMin);

  var color = [];
  for (var i = 0; i < 3; i++) {
    // calculate an integer color based on the delta
    color[i] = (high[i] - low[i]) * delta + low[i];
  }

  // determine whether to show this shape or not
  var showRow = true;
  if (feature.getProperty('stat_variable') == null ||
      isNaN(feature.getProperty('stat_variable'))) {
    showRow = false;
  }

  var outlineWeight = 0.5, zIndex = 1;
  if (feature.getProperty('state') === 'hover') {
    outlineWeight = zIndex = 2;
  }

  return {
    strokeWeight: outlineWeight,
    strokeColor: '#fff',
    zIndex: zIndex,
    fillColor: 'hsl(' + color[0] + ',' + color[1] + '%,' + color[2] + '%)',
    fillOpacity: 0.75,
    visible: showRow
  };
}

/**
 * Responds to the mouse-in event on a map shape (state).
 *
 * @param {?google.maps.MouseEvent} e
 */
function mouseInToRegion(e) {
  // set the hover state so the setStyle function can change the border
  e.feature.setProperty('state', 'hover');

  var percent = (e.feature.getProperty('stat_variable') - statMin) /
      (statMax - statMin) * 100;

  // update the label
  document.getElementById('data-label').textContent =
      e.feature.getProperty('NAME');
  document.getElementById('data-value').textContent =
      e.feature.getProperty('stat_variable').toLocaleString();
  document.getElementById('data-box').style.display = 'block';
  document.getElementById('data-caret').style.display = 'block';
  document.getElementById('data-caret').style.paddingLeft = percent + '%';
}

/**
 * Responds to the mouse-out event on a map shape (state).
 *
 * @param {?google.maps.MouseEvent} e
 */
function mouseOutOfRegion(e) {
  // reset the hover state, returning the border to normal
  e.feature.setProperty('state', 'normal');
}
