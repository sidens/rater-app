$(function () {

  function toTitleCase(str) {
    return str.toLowerCase().replace(/(?:^|\s)\w/g, function (m) {
      return m.toUpperCase();
    });
  }

  var params = new URLSearchParams(window.location.search);

  var savedCity = params.get('city') || localStorage.getItem('city');
  if (savedCity) $('#city').val(savedCity);

  var savedQ = params.get('q') || localStorage.getItem('q');
  if (savedQ) $('.query').val(savedQ);

  var regions = {
    LAC: {
      // LA County's Socrata endpoint was retired (now redirects to hub.arcgis.com/legacy).
      // Using City of LA's Socrata portal (same LA County Environmental Health inspection system).
      // Full county coverage will be restored in Phase 2 via a backend that serves the CSV.
      apiUrl: 'https://data.lacity.org/resource/29fd-3paw.json',
      nameField: 'facility_name',
      businessIdField: 'facility_id',
      gradeField: 'score',
      whereParam: 'IS NOT NULL',
      ratings: {},
      scale: '0-100',
      detailsUrl: 'http://publichealth.lacounty.gov/eh/AreasofInterest/food.htm',
      attributionUrl: 'https://data.lacity.org/Community-Economic-Development/Restaurant-and-Market-Health-Inspections/29fd-3paw',
      addressField: 'facility_address',
      regionName: 'Los Angeles, CA'
    },
    NYC: {
      apiUrl: 'https://data.cityofnewyork.us/resource/9w7m-hzhe.json',
      nameField: 'dba',
      businessIdField: 'camis',
      gradeField: 'grade',
      whereParam: 'IS NOT NULL',
      ratings: { A: 'img/NYC/a.png', B: 'img/NYC/b.png', C: 'img/NYC/c.png', P: 'img/NYC/p.png', Z: 'img/NYC/p.png', 'Not Yet Graded': 'img/NYC/notyetrated.png' },
      scale: 'img/NYC/nyc-scale.png',
      detailsUrl: 'https://www1.nyc.gov/assets/doh/downloads/pdf/rii/inspection-cycle-overview.pdf',
      attributionUrl: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j',
      addressField: 'street',
      regionName: 'New York City'
    },
    SFO: {
      apiUrl: 'https://data.sfgov.org/resource/sipz-fjte.json',
      nameField: 'business_name',
      businessIdField: 'business_id',
      gradeField: 'inspection_score',
      whereParam: 'IS NOT NULL',
      ratings: {},
      scale: '0-100',
      detailsUrl: 'https://www.sfdph.org/dph/EH/Food/Score/',
      attributionUrl: 'https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i',
      addressField: 'business_address',
      regionName: 'San Francisco'
    },
    SEA: {
      apiUrl: 'https://data.kingcounty.gov/resource/gkhn-e8mn.json',
      nameField: 'name',
      businessIdField: 'business_id',
      gradeField: 'grade',
      whereParam: 'IS NOT NULL',
      ratings: { 1: 'img/SEA/excellent_50.gif', 2: 'img/SEA/good_50.gif', 3: 'img/SEA/okay_50.gif', 4: 'img/SEA/needstoimprove_50.gif' },
      scale: 'img/SEA/food-safety-ratings-emoji.png',
      detailsUrl: 'https://www.kingcounty.gov/depts/health/environmental-health/food-safety/inspection-system/food-safety-rating.aspx',
      attributionUrl: 'https://data.kingcounty.gov/Health/Food-Establishment-Inspection-Data/f29f-zza5',
      addressField: 'ADDRESS',
      regionName: 'Seattle'
    }
  };

  var currentResults = [];
  var currentRegion = null;
  var sortCol = null;
  var sortAsc = true;

  function renderTableBody() {
    var $tbody = $('#resultslist tbody').empty();
    if (currentResults.length === 0) {
      $tbody.append(
        $('<tr>').append($('<td>').attr('colspan', 3).text('No results found'))
      );
      return;
    }
    currentResults.forEach(function (result) {
      var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(result.name + ' ' + result.address + ' ' + currentRegion.regionName);
      var $tr = $('<tr>');
      $('<td>').text(result.name).appendTo($tr);
      $('<td>').append(
        $('<a>').attr({ href: mapsUrl, target: '_blank' }).text(result.address)
      ).appendTo($tr);
      var $gradeTd = $('<td>');
      var imgSrc = currentRegion.ratings[result.grade];
      if (imgSrc) {
        $('<img>').attr({ src: imgSrc, width: 50, alt: 'Grade ' + result.grade }).appendTo($gradeTd);
      } else {
        $gradeTd.text(result.grade);
      }
      $gradeTd.appendTo($tr);
      $tbody.append($tr);
    });
  }

  function updateSortHeaders() {
    $('th[data-sort]').each(function () {
      var col = $(this).data('sort');
      var label = $(this).data('label');
      $(this).text(label + (col === sortCol ? (sortAsc ? ' ▲' : ' ▼') : ''));
    });
  }

  $(document).on('click', 'th[data-sort]', function () {
    var col = $(this).data('sort');
    if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }
    currentResults.sort(function (a, b) {
      var va = String(a[col] || '').toLowerCase();
      var vb = String(b[col] || '').toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateSortHeaders();
    renderTableBody();
  });

  $('#new-search').on('click', function () {
    $('#results_wrapper').hide();
    $('#rest_grades').empty();
    $('#scale').empty();
    currentResults = [];
    currentRegion = null;
    sortCol = null;
    history.replaceState(null, '', window.location.pathname);
    $('.query').val('').trigger('focus');
  });

  $('#search').submit(function (event) {
    event.preventDefault();
    $('#loading').show();
    $('#results_wrapper').hide();
    $('#rest_grades').empty();
    $('#scale').empty();

    var search = $('.query').val();
    var regionKey = $('#city').val();

    localStorage.setItem('city', regionKey);
    localStorage.setItem('q', search);

    var url = new URL(window.location.href);
    url.searchParams.set('city', regionKey);
    url.searchParams.set('q', search);
    history.replaceState(null, '', url);

    var region = regions[regionKey];
    currentRegion = region;
    sortCol = null;
    sortAsc = true;

    $.ajax({
      url: region.apiUrl,
      type: 'GET',
      data: {
        $select: [region.nameField, region.businessIdField, region.gradeField, region.addressField].join(', '),
        $where: region.gradeField + ' ' + region.whereParam,
        $q: search,
        $limit: 500,
        $$app_token: 'CE7uCoAw5PG2KLRXRhRTCaIaM'
      }
    }).done(function (listings) {
      $('#loading').hide();
      $('#results_wrapper').show();

      var isImage = region.scale.indexOf('.') !== -1;
      $('#scale').append(
        $('<div>').attr('id', 'ratingdetails').append(
          $('<h2>').text(region.regionName + '’s Rating Scale'),
          $('<br>'),
          isImage
            ? $('<img>').attr({ src: region.scale, width: '60%', alt: region.regionName + ' rating scale' })
            : $('<span>').text(region.scale)
        ),
        $('<div>').attr('id', 'attribution').append(
          $('<a>').attr({ href: region.detailsUrl, target: '_blank' }).text('More Details'),
          '   |   ',
          $('<a>').attr({ href: region.attributionUrl, target: '_blank' }).text('Open Data Source')
        ),
        $('<br>')
      );

      var resultsmap = {};
      listings.forEach(function (listing) {
        var id = listing[region.businessIdField];
        resultsmap[id] = {
          name: toTitleCase(String(listing[region.nameField] || '')),
          grade: String(listing[region.gradeField] || ''),
          address: String(listing[region.addressField] || '')
        };
      });
      currentResults = Object.values(resultsmap);

      $('#rest_grades').append(
        $('<table>').attr('id', 'resultslist').css('margin', '0 auto').append(
          $('<thead>').append(
            $('<tr>').append(
              $('<th>').text('Name').attr({ 'data-sort': 'name', 'data-label': 'Name' }),
              $('<th>').text('Address').attr({ 'data-sort': 'address', 'data-label': 'Address' }),
              $('<th>').text('Rating').attr({ 'data-sort': 'grade', 'data-label': 'Rating' })
            )
          ),
          $('<tbody>')
        )
      );

      renderTableBody();

    }).fail(function () {
      $('#loading').hide();
      $('#results_wrapper').show();
      $('#rest_grades').append(
        $('<p>').text('Could not load results. Please check your connection and try again.')
      );
    });
  });

  if (params.get('q')) {
    $('#search').trigger('submit');
  }
});
