import { reactive } from 'vue'
import { useStorage } from '@vueuse/core'
import { getCurrentDate } from '@/composables/utils.ts'

const { currentYear, currentDate } = getCurrentDate()

const defaultSettings = {
  numOfGenerators: 1,
  radius: 500,
  oneCountryAtATime: false,
  onlyCheckBlueLines: false,
  findRegions: false,
  regionRadius: 100,

  rejectUnofficial: true,
  rejectOfficial: false,
  findByGeneration: {
    enabled: true,
    generation: {
      1: false,
      23: true,
      4: true,
    },
  },
  rejectDateless: true,
  rejectNoDescription: true,
  rejectDescription: false,
  searchInDescription: {
    enabled: false,
    searchTerms: '',
    searchMode: 'contains',
    filterType: 'include',
  } as SearchInDescriptionConfig,
  onlyOneInTimeframe: false,
  findPhotospheres: false,
  findDrones: false,
  checkLinks: false,
  linksDepth: 2,

  rejectByYear: false,
  fromDate: '2009-01',
  toDate: currentDate,
  fromMonth: '01',
  toMonth: '12',
  fromYear: '2007',
  toYear: currentYear,
  selectMonths: false,
  checkAllDates: false,
  randomInTimeline: false,

  findByTileColor: {
    enabled: false,
    zoom: 19,
    filterType: 'include',
    operator: 'OR',
    tileProvider: 'gmaps',
    tileColors: {
      gmaps: [
        {
          label: 'Highways',
          active: false,
          threshold: 0.05,
          colors: [
            '139,165,193', // rgb(139,165,193)
            '112,144,178', // rgb(112,144,178)
          ],
        },
        {
          label: 'Roads, streets',
          active: false,
          threshold: 0.05,
          colors: [
            '170,185,201', // rgb(170,185,201)
            '193,204,216', // rgb(193,204,216)
            '186,201,215', // rgb(186,201,215)
            '203,217,230', // rgb(203,217,230)
            '204,215,224', // rgb(204,215,224)
            '204,215,222', // rgb(204,215,222)
            '216,224,231', // rgb(216,224,231)
          ], // zoom levels: 1:19, 2:18 (found two colors at same zoom), 3:18, 4:17, 5:16, 6:15
        },
        {
          label: 'Smaller roads, pathways',
          active: false,
          threshold: 0.05,
          colors: [
            '219,224,232', // rgb(219,224,232) min zoom 17
          ],
        },
        {
          label: 'Train tracks',
          active: false,
          threshold: 0.001,
          colors: [
            '189,193,198', // rgb(189,193,198)
            '193,197,202', // rgb(193,197,202)
            '195,199,203', // rgb(195,199,203)
            '201,205,209', // rgb(201,205,209)
            '203,206,211', // rgb(203,206,211)
            '205,208,212', // rgb(205,208,212)
            '206,209,212', // rgb(206,209,212)
          ], // kind of arbitrary values as train tracks are really thin, but looks good enough and no false positives for now
        },
        {
          label: 'Buildings',
          active: false,
          threshold: 0.05,
          colors: [
            '232,233,237', // rgb(232,233,237)
            '232,232,236', // rgb(232,232,236)
            '230,234,237', // rgb(230,234,237)
            '230,234,238', // rgb(230,234,238)
            '234,234,238', // rgb(234,234,238)
            '221,227,229', // rgb(221,227,229)
            '231,231,235', // rgb(231,231,235)
            '231,231,236', // rgb(231,231,236)
            '231,231,238', // rgb(231,231,238)
            '231,234,238', // rgb(231,234,238)
          ], // min zoom 17
        },
        {
          label: 'Commercial buildings',
          active: false,
          threshold: 0.05,
          colors: [
            '253,249,239', // rgb(253,249,239) min zoom 17
            '248,240,222', // rgb(248,240,222) zoom 16 and under
          ],
        },
        {
          label: 'Urban areas',
          active: false,
          threshold: 0.2,
          colors: [
            '248,247,247', // rgb(248,247,247) : 17 and above
            '246,245,245', // rgb(246,245,245) : 16
            '245,243,243', // rgb(245,243,243) : 15
          ],
        },
        {
          label: 'Airports, etc',
          active: false,
          threshold: 0.2,
          colors: [
            '231,237,252', // rgb(231,237,252) : 16 and above
            '230,237,249', // rgb(230,237,249) : 15
          ],
        },
        {
          label: 'Vegetation, trees, brush',
          active: false,
          threshold: 0.2,
          colors: [
            '211,248,226', // rgb(211,248,226) : all zooms
          ],
        },
        {
          label: 'Dense vegetation, thick forest',
          active: false,
          threshold: 0.2,
          colors: [
            '195,241,213', // rgb(195,241,213) : all zooms
          ],
        },
        {
          label: 'Scrub, grass',
          active: false,
          threshold: 0.2,
          colors: [
            '245,240,229', // rgb(245,240,229) : 15 and above
            '245,240,230', // rgb(245,240,230) : 15 and above
          ],
        },
        {
          label: 'Sparse vegetation, rocky ground',
          active: false,
          threshold: 0.2,
          colors: [
            '242,231,212', // rgb(242,231,212) : all zooms
          ],
        },
        {
          label: 'Sand dunes, glaciers...',
          active: false,
          threshold: 0.2,
          colors: [
            '235,233,229', // rgb(235,233,229) : 15 and above
            '255,255,255', // rgb(255,255,255) : glaciers all zooms
          ],
        },
        {
          label: 'Water',
          active: false,
          threshold: 0.2,
          colors: [
            '144,218,238', // rgb(144,218,238) : all zooms
          ],
        },
      ],
    },
  } as TileColorConfig,

  filterByLinksLength: {
    enabled: false,
    range: [1, 5],
  },
  getCurve: false,
  minCurveAngle: 10,

  heading: {
    adjust: true,
    reference: 'link',
    range: [0, 0],
    randomInRange: false,
  },
  pitch: {
    adjust: false,
    range: [0, 0],
    randomInRange: false,
  },
  zoom: {
    adjust: false,
    range: [0, 0],
    randomInRange: false,
  },
  markers: {
    gen1: true,
    gen2Or3: true,
    gen4: true,
    newRoad: true,
    noBlueLine: true,
    cluster: false,
  },
  placeMarkers: true,
  markersOnImport: true,
  checkImports: false,
}

const storedSettings = useStorage('map_generator__settings_v11', defaultSettings, undefined, {
  mergeDefaults: true,
})
const settings = reactive(storedSettings.value)
settings.toDate = currentDate
settings.toYear = currentYear

export { settings }
