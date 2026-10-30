// Civic Resolve AI: Municipal Spatial Geocoding & Reverse Geocoding Engine
// Provides high-accuracy address resolution, landmark matching, and offline fallback for citizen incident reporting.

const express = require('express');
const router = express.Router();
const https = require('https');

// Municipal Landmarks & Localities Spatial Index (Hyderabad & Greater Metropolitan Area)
const LOCAL_LANDMARKS = [
  { name: 'Banjara Hills, Road No. 12', locality: 'Banjara Hills', lat: 17.4177, lng: 78.4399, pincode: '500034' },
  { name: 'Banjara Hills, Road No. 1', locality: 'Banjara Hills', lat: 17.4201, lng: 78.4485, pincode: '500034' },
  { name: 'Jubilee Hills, Checkpost & Road 36', locality: 'Jubilee Hills', lat: 17.4319, lng: 78.4073, pincode: '500033' },
  { name: 'Hitech City, Cyber Towers', locality: 'Madhapur', lat: 17.4504, lng: 78.3808, pincode: '500081' },
  { name: 'Madhapur, Near Durgam Cheruvu', locality: 'Madhapur', lat: 17.4428, lng: 78.3915, pincode: '500081' },
  { name: 'Gachibowli, ORR Junction & DLF', locality: 'Gachibowli', lat: 17.4401, lng: 78.3489, pincode: '500032' },
  { name: 'Financial District, Nanakramguda', locality: 'Nanakramguda', lat: 17.4190, lng: 78.3370, pincode: '500032' },
  { name: 'Kondapur, RTO & Botanical Garden', locality: 'Kondapur', lat: 17.4615, lng: 78.3672, pincode: '500084' },
  { name: 'Kukatpally, KPHB Colony & JNTU', locality: 'Kukatpally', lat: 17.4875, lng: 78.3953, pincode: '500072' },
  { name: 'Miyapur, Metro Terminal', locality: 'Miyapur', lat: 17.4968, lng: 78.3614, pincode: '500049' },
  { name: 'Ameerpet, Mythrivanam Cross Road', locality: 'Ameerpet', lat: 17.4375, lng: 78.4483, pincode: '500016' },
  { name: 'Panjagutta, Central Mall Junction', locality: 'Panjagutta', lat: 17.4265, lng: 78.4526, pincode: '500082' },
  { name: 'Somajiguda, Raj Bhavan Road', locality: 'Somajiguda', lat: 17.4256, lng: 78.4589, pincode: '500082' },
  { name: 'Begumpet, Old Airport Road', locality: 'Begumpet', lat: 17.4441, lng: 78.4659, pincode: '500016' },
  { name: 'Secunderabad, Clock Tower & Station', locality: 'Secunderabad', lat: 17.4399, lng: 78.4983, pincode: '500003' },
  { name: 'Paradise, MG Road Junction', locality: 'Secunderabad', lat: 17.4422, lng: 78.4878, pincode: '500003' },
  { name: 'Charminar, Old City Monument Area', locality: 'Old City', lat: 17.3616, lng: 78.4747, pincode: '500002' },
  { name: 'Falaknuma, Palace Road', locality: 'Falaknuma', lat: 17.3314, lng: 78.4682, pincode: '500053' },
  { name: 'Mehdipatnam, Rythu Bazar & Bus Depot', locality: 'Mehdipatnam', lat: 17.3916, lng: 78.4419, pincode: '500028' },
  { name: 'Tolichowki, Galaxy Theatre Junction', locality: 'Tolichowki', lat: 17.4024, lng: 78.4111, pincode: '500008' },
  { name: 'Shaikpet, Dargah & Seven Tombs Road', locality: 'Shaikpet', lat: 17.4087, lng: 78.3978, pincode: '500008' },
  { name: 'Dilsukhnagar, Main Road & Metro', locality: 'Dilsukhnagar', lat: 17.3688, lng: 78.5247, pincode: '500060' },
  { name: 'LB Nagar, Ring Road Junction', locality: 'LB Nagar', lat: 17.3457, lng: 78.5522, pincode: '500074' },
  { name: 'Nagole, Inner Ring Road & Metro', locality: 'Nagole', lat: 17.3755, lng: 78.5601, pincode: '500068' },
  { name: 'Uppal, Stadium & Crossroads', locality: 'Uppal', lat: 17.4018, lng: 78.5602, pincode: '500039' },
  { name: 'Habsiguda, Street No. 8 & NGRI', locality: 'Habsiguda', lat: 17.4168, lng: 78.5427, pincode: '500007' },
  { name: 'Tarnaka, Osmania University Road', locality: 'Tarnaka', lat: 17.4278, lng: 78.5298, pincode: '500017' },
  { name: 'Manikonda, Puppalguda Main Road', locality: 'Manikonda', lat: 17.4005, lng: 78.3792, pincode: '500089' },
  { name: 'Attapur, PVNR Expressway Pillar 143', locality: 'Attapur', lat: 17.3725, lng: 78.4312, pincode: '500048' },
  { name: 'Nampally, Public Gardens & Station', locality: 'Nampally', lat: 17.3912, lng: 78.4682, pincode: '500001' },
  { name: 'Abids, Taj Mahal Hotel & GPO', locality: 'Abids', lat: 17.3888, lng: 78.4735, pincode: '500001' },
  { name: 'Khairatabad, RTA & Bada Ganesh Road', locality: 'Khairatabad', lat: 17.4116, lng: 78.4608, pincode: '500004' },
  { name: 'Lakdikapul, Telephone Bhavan Junction', locality: 'Lakdikapul', lat: 17.4038, lng: 78.4651, pincode: '500004' },
  { name: 'SR Nagar, Umesh Chandra Statue Road', locality: 'SR Nagar', lat: 17.4435, lng: 78.4412, pincode: '500038' },
  { name: 'Alwal, IG Statue & Temple Road', locality: 'Alwal', lat: 17.5022, lng: 78.5085, pincode: '500010' },
  { name: 'Kompally, Cine Planet & NH44', locality: 'Kompally', lat: 17.5385, lng: 78.4872, pincode: '500100' },
  { name: 'Bowenpally, Hasmatpet & Diamond Point', locality: 'Bowenpally', lat: 17.4765, lng: 78.4878, pincode: '500011' },
  { name: 'Chandanagar, Gangaram & Railway Station', locality: 'Chandanagar', lat: 17.4925, lng: 78.3275, pincode: '500050' },
  { name: 'Lingampally, BHEL Township Gate', locality: 'Lingampally', lat: 17.4878, lng: 78.3182, pincode: '500019' },
  { name: 'Malkajgiri, Geetha Theatre & Anandbagh', locality: 'Malkajgiri', lat: 17.4525, lng: 78.5312, pincode: '500047' },
  { name: 'ECIL, Crossroads & Radhika Theatre', locality: 'ECIL', lat: 17.4722, lng: 78.5712, pincode: '500062' },
  { name: 'AS Rao Nagar, Main Road & Park', locality: 'AS Rao Nagar', lat: 17.4815, lng: 78.5528, pincode: '500062' },
  { name: 'Kacheguda, Railway Station & Tourist Hotel', locality: 'Kacheguda', lat: 17.3912, lng: 78.4985, pincode: '500027' },
  { name: 'Malakpet, Super Bazar & Chanchalguda', locality: 'Malakpet', lat: 17.3755, lng: 78.4982, pincode: '500036' },
  { name: 'Himayatnagar, Liberty & Narayanguda Flyover', locality: 'Himayatnagar', lat: 17.4022, lng: 78.4882, pincode: '500029' },
  { name: 'Shamshabad, Airport Approach Road', locality: 'Shamshabad', lat: 17.2515, lng: 78.4285, pincode: '501218' }
];

// Helper: Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Memory cache for reverse lookups (LRU-style, max 100 entries)
const geocodeCache = new Map();

function getCachedGeocode(key) {
  return geocodeCache.get(key) || null;
}

function setCachedGeocode(key, val) {
  if (geocodeCache.size > 200) {
    const firstKey = geocodeCache.keys().next().value;
    geocodeCache.delete(firstKey);
  }
  geocodeCache.set(key, val);
}

// Safe server-side HTTPS fetch with 3.5s timeout & proper User-Agent
function fetchExternalJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'CivicResolveAI/1.0 (civic.resolve.ai.portal@gmail.com)',
        'Accept': 'application/json'
      },
      timeout: 3500
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Geocode request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * GET /api/geocode/reverse?lat=17.4201&lng=78.4485
 * Reverse geocodes coordinates to a clean, usable municipal address.
 */
router.get('/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid lat and lng numeric query parameters are required.' });
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = getCachedGeocode(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // 1. Check local high-precision spatial landmark index first (< 600 meters)
  let closestLandmark = null;
  let minDistance = Infinity;

  for (const lm of LOCAL_LANDMARKS) {
    const dist = haversineDistanceMeters(lat, lng, lm.lat, lm.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestLandmark = lm;
    }
  }

  // 2. Try Nominatim reverse geocode via server proxy with timeout
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const data = await fetchExternalJson(nominatimUrl);

    if (data && data.display_name) {
      const addr = data.address || {};
      const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.residential;
      const locality = addr.suburb || addr.neighbourhood || addr.city_district || (closestLandmark ? closestLandmark.locality : 'Central');
      const city = addr.city || addr.town || addr.county || 'Hyderabad';
      const postcode = addr.postcode ? ` - ${addr.postcode}` : '';

      let formattedAddress = '';
      if (street && locality && street.toLowerCase() !== locality.toLowerCase()) {
        formattedAddress = `${street}, ${locality}, ${city}${postcode}`;
      } else if (street) {
        formattedAddress = `${street}, ${city}${postcode}`;
      } else if (closestLandmark && minDistance < 1200) {
        formattedAddress = `Near ${closestLandmark.name}, ${city}`;
      } else {
        formattedAddress = data.display_name.split(',').slice(0, 3).join(', ').trim();
      }

      const result = {
        success: true,
        displayName: formattedAddress,
        locality: locality,
        city: city,
        latitude: lat,
        longitude: lng,
        source: 'nominatim_verified'
      };

      setCachedGeocode(cacheKey, result);
      return res.json(result);
    }
  } catch (err) {
    console.warn('[Geocode Notice] External geocode fallback invoked:', err.message);
  }

  // 3. Resilient spatial index fallback when external service is offline or rate-limited
  if (closestLandmark && minDistance < 2500) {
    const distDesc = minDistance < 150 ? '' : ` (~${Math.round(minDistance)}m from ${closestLandmark.name})`;
    const result = {
      success: true,
      displayName: `${closestLandmark.name}, Hyderabad${distDesc}`,
      locality: closestLandmark.locality,
      city: 'Hyderabad',
      latitude: lat,
      longitude: lng,
      source: 'local_spatial_index'
    };
    setCachedGeocode(cacheKey, result);
    return res.json(result);
  }

  // 4. Default coordinates tag
  const fallbackResult = {
    success: true,
    displayName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Hyderabad`,
    locality: 'Hyderabad',
    city: 'Hyderabad',
    latitude: lat,
    longitude: lng,
    source: 'coordinate_pin'
  };
  return res.json(fallbackResult);
});

/**
 * GET /api/geocode/search?q=gachibowli
 * Searches landmarks, localities, and streets with instant autocomplete suggestions.
 */
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query || query.length < 2) {
    return res.json({ results: [] });
  }

  const results = [];
  const seenNames = new Set();

  // 1. Instant local index fuzzy match
  for (const lm of LOCAL_LANDMARKS) {
    const matchName = lm.name.toLowerCase().includes(query);
    const matchLoc = lm.locality.toLowerCase().includes(query);
    const matchPin = lm.pincode && lm.pincode.includes(query);

    if (matchName || matchLoc || matchPin) {
      seenNames.add(lm.name);
      results.push({
        name: `${lm.name}, Hyderabad (${lm.pincode})`,
        locality: lm.locality,
        latitude: lm.lat,
        longitude: lm.lng,
        source: 'local_verified'
      });
      if (results.length >= 6) break;
    }
  }

  // 2. Query Nominatim if results are few
  if (results.length < 4) {
    try {
      const qEncoded = encodeURIComponent(query.includes('hyderabad') ? query : `${query}, Hyderabad, Telangana`);
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${qEncoded}&limit=4&addressdetails=1&viewbox=78.10,17.15,78.75,17.65&bounded=0`;
      const data = await fetchExternalJson(searchUrl);

      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const shortName = item.display_name.split(',').slice(0, 3).join(', ').trim();

          if (!seenNames.has(shortName) && !isNaN(lat) && !isNaN(lng)) {
            seenNames.add(shortName);
            results.push({
              name: shortName,
              locality: item.address?.suburb || item.address?.neighbourhood || 'Hyderabad',
              latitude: lat,
              longitude: lng,
              source: 'osm_search'
            });
            if (results.length >= 6) break;
          }
        }
      }
    } catch (err) {
      console.warn('[Geocode Notice] External search fallback:', err.message);
    }
  }

  res.json({ results });
});

module.exports = router;
