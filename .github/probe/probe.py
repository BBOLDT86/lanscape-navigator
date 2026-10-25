"""Temporary: what do these public data services answer from GitHub's runners? Writes probe.json."""
import datetime as dt, gzip, json, urllib.request
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
NQ = {'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/', 'Accept': 'application/json'}
d = dt.date.today(); y = d - dt.timedelta(days=1)
T = {
 'nasdaq_chain_xom': ('https://api.nasdaq.com/api/quote/XOM/option-chain?assetclass=stocks&limit=40&fromdate=2026-10-30&todate=2026-11-06&excode=oprac&callput=callput&money=at&type=all', NQ),
 'nasdaq_chain_spy': ('https://api.nasdaq.com/api/quote/SPY/option-chain?assetclass=etf&limit=40&fromdate=2026-10-26&todate=2026-10-30&excode=oprac&callput=callput&money=at&type=all', NQ),
 'nasdaq_profile_xom': ('https://api.nasdaq.com/api/company/XOM/company-profile', NQ),
 'cboe_xom': ('https://cdn.cboe.com/api/global/delayed_quotes/options/XOM.json', {}),
 'cboe_spy': ('https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json', {}),
 'cboe_quote_spy': ('https://cdn.cboe.com/api/global/delayed_quotes/quotes/SPY.json', {}),
 'eia_demo': ('https://api.eia.gov/v2/electricity/rto/region-data/data/?api_key=DEMO_KEY&frequency=hourly&data[0]=value&facets[respondent][]=US48&sort[0][column]=period&sort[0][direction]=desc&length=5', {}),
 'eia_930_internal': (f'https://www.eia.gov/electricity/930-api/region_data/series_data?type[0]=D&respondent[0]=US48&frequency=hourly&limit=5&offset=0', {}),
 'ercot_fuel': ('https://www.ercot.com/api/1/services/read/dashboards/fuel-mix.json', {}),
 'ercot_supply': ('https://www.ercot.com/api/1/services/read/dashboards/supply-demand.json', {}),
 'ercot_prices': ('https://www.ercot.com/api/1/services/read/dashboards/systemWidePrices.json', {}),
 'caiso_fuel': ('https://www.caiso.com/outlook/current/fuelsource.csv', {}),
 'caiso_demand': ('https://www.caiso.com/outlook/current/demand.csv', {}),
 'caiso_co2': ('https://www.caiso.com/outlook/current/co2.csv', {}),
 'miso_fuel': ('https://api.misoenergy.org/MISORTWDDataBroker/DataBrokerServices.asmx?messageType=getfuelmix&returnType=json', {}),
 'miso_lmp': ('https://api.misoenergy.org/MISORTWDDataBroker/DataBrokerServices.asmx?messageType=getLMPConsolidatedTable&returnType=json', {}),
 'nyiso_fuel': (f'https://mis.nyiso.com/public/csv/rtfuelmix/{y:%Y%m%d}rtfuelmix.csv', {}),
 'nyiso_lbmp': (f'https://mis.nyiso.com/public/csv/realtime/{y:%Y%m%d}realtime_zone.csv', {}),
 'isone_fuel': (f'https://www.iso-ne.com/transform/csv/genfuelmix?start={y:%Y%m%d}', {}),
 'isone_ws': ('https://webservices.iso-ne.com/api/v1.1/genfuelmix/current.json', {}),
 'spp_mix': ('https://portal.spp.org/chart-api/gen-mix-365/asFile', {}),
 'spp_mix2': ('https://marketplace.spp.org/chart-api/gen-mix/asFile', {}),
 'pjm_fuel': ('https://api.pjm.com/api/v1/gen_by_fuel?rowCount=20&startRow=1&sort=datetime_beginning_ept&order=desc', {}),
 'pjm_settings': ('https://dataminer2.pjm.com/config/settings.json', {}),
 'dbnomics_bls_elec': ('https://api.db.nomics.world/v22/series/BLS/ap/APU000072610?observations=1', {}),
 'dbnomics_eia': ('https://api.db.nomics.world/v22/providers/EIA', {}),
 'gridstatus_open': ('https://api.gridstatus.io/v1/datasets', {}),
 'dcd_rss': ('https://www.datacenterdynamics.com/en/rss/', {}),
 'dcf_rss': ('https://www.datacenterfrontier.com/rss', {}),
 'utilitydive_rss': ('https://www.utilitydive.com/feeds/news/', {}),
 'canary_rss': ('https://www.canarymedia.com/rss.rss', {}),
 'latitude_rss': ('https://www.latitudemedia.com/feed', {}),
 'heatmap_rss': ('https://heatmap.news/feeds/feed.rss', {}),
 'powermag_rss': ('https://www.powermag.com/feed/', {}),
 'eenews_rss': ('https://www.eenews.net/feed/', {}),
}
out = {}
for k, (u, h) in T.items():
    try:
        req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Encoding': 'gzip', 'Accept-Language': 'en-US,en;q=0.9', **h})
        with urllib.request.urlopen(req, timeout=40) as r:
            b = r.read()
            if b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
            out[k] = {'status': r.status, 'len': len(b), 'ctype': r.headers.get('Content-Type'), 'head': b[:2500].decode('utf-8', 'replace')}
            if k.startswith('cboe_') and b[:1] == b'{':
                j = json.loads(b); dd = j.get('data') or {}
                out[k]['keys'] = list(dd.keys())[:40]
                ops = dd.get('options') or []
                out[k]['n_options'] = len(ops); out[k]['sample'] = ops[:3]
                out[k]['meta'] = {kk: vv for kk, vv in dd.items() if kk != 'options'}
    except Exception as ex:
        out[k] = {'error': repr(ex)[:400]}
json.dump(out, open('probe.json', 'w'), indent=1)
print({k: v.get('status', v.get('error', '')[:60]) for k, v in out.items()})
