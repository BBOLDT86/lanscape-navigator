import json, urllib.request, urllib.error, time, os, gzip
UA = 'FindsBot/1.0 (https://bboldt86.github.io/lanscape-navigator/shop/; the-watch-news@users.noreply.github.com)'
STORES = {
 'fashion': ['toddsnyder.com','buckmason.com','taylorstitch.com','fahertybrand.com','rhone.com','vuoriclothing.com','outerknown.com','allbirds.com','marinelayer.com','mackweldon.com','kotn.com','rothys.com','thursdayboots.com','oliver-cabell.com','ministryofsupply.com','djerfavenue.com','gymshark.com','aloyoga.com','travismathew.com','huckberry.com','unboundmerino.com','proper-cloth.com','jcrew.com','madewell.com','quince.com'],
 'trending': ['stanley1913.com','owalalife.com','rhodeskin.com','glossier.com','summerfridays.com','comfrt.com','shopbala.com','fromourplace.com','carawayhome.com','dae.com','solawave.co','touchland.com','kyliecosmetics.com','drinkolipop.com','mielleorganics.com','tower28beauty.com','merit.com'],
 'gifts': ['brightland.co','graza.co','ember.com','courant.com','nomadgoods.com','ridge.com','solostove.com','parachutehome.com','bellroy.com','snowehome.com','fishwife.com','mostlymade.com','loops.com'],
 'coffee': ['fellowproducts.com','normcorewares.com','primacoffee.com','clivecoffee.com','weberworkshops.com','onyxcoffeelab.com','counterculturecoffee.com','timemore.com','baratza.com','espressoparts.com','subminimal.com','loveramics.com','acaia.co','varia-brewing.com','kinto-usa.com'],
 'kitchen': ['hexclad.com','greatjonesgoods.com','materialkitchen.com','misen.com','madeincookware.com','fromourplace.com','carawayhome.com','graza.co','brightland.co','tojiro.com','japanesechefsknife.com','dalstrong.com','zwilling.com','ooni.com'],
 'home': ['brooklinen.com','parachutehome.com','schoolhouse.com','bollandbranch.com','cozyearth.com','floydhome.com','burrow.com','luluandgeorgia.com','ruggable.com','snowehome.com','hay.com','jenniferfurniture.com','article.com','tuftandneedle.com'],
 'remodel': ['schoolhouse.com','totalboat.com','coastaltool.com','bostongeneralstore.com','kregtool.com','rejuvenation.com','emtek.com','rubiomonocoatusa.com','woodpeck.com','harborfreight.com'],
 'tech': ['anker.com','eufy.com','us.soundcore.com','ugreen.com','nanoleaf.me','satechi.net','twelvesouth.com','peakdesign.com','auraframes.com','nativeunion.com','nomadgoods.com','courant.com','ember.com','keychron.com','orbitkey.com'],
 'garage': ['adamspolishes.com','chemicalguys.com','griotsgarage.com','obsessedgarage.com','carpro-us.com','theragcompany.com','autogeek.net','detailedimage.com','koch-chemie.com','gyeon.us'],
 'outdoors': ['cotopaxi.com','snowpeak.com','bioliteenergy.com','monos.com','rumpl.com','stanley1913.com','solostove.com','peakdesign.com','tropicfeel.com','mysteryranch.com','hydroflask.com','yeti.com','topodesigns.com','kelty.com'],
 'wellness': ['hyperice.com','icebarrel.com','tenthousand.cc','mudwtr.com','livemomentous.com','mantasleep.com','hatch.co','lmnt.com','manduka.com','theragun.com','vuoriclothing.com','rhone.com','ouraring.com','eightsleep.com'],
 'equestrian': ['kerrits.com','dreamersandschemers.com','ogilvyequestrian.com','bitofbritain.com','ecogold.com','equiline.it','samshield.com','horsepilot.com','fairplayequestrian.com','smartpak.com','doversaddlery.com','ridingwarehouse.com','theequestrianshop.com','horzeusa.com','tredstep.com','ariat.com'],
}
def get(url, keep=None):
    t=time.time()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json', 'Accept-Encoding': 'gzip'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            b=r.read()
            if r.headers.get('Content-Encoding')=='gzip': b=gzip.decompress(b)
            return r.status, r.geturl(), b
    except urllib.error.HTTPError as e:
        return e.code, url, b''
    except Exception as e:
        return None, url, repr(e).encode()
out={}
seen=set()
for sec, doms in STORES.items():
    for d in doms:
        if d in seen: out.setdefault('_dupes',[]).append([sec,d]); continue
        seen.add(d)
        rec={'sec':sec}
        st, final, b = get(f'https://{d}/collections.json?limit=250')
        rec['cstatus']=st; rec['final']=final
        try:
            cj=json.loads(b); rec['collections']=[[c['handle'], c.get('title'), c.get('products_count')] for c in cj.get('collections',[])]
        except Exception: rec['collections']=None; rec['cbody']=b[:120].decode('utf-8','replace')
        st2, final2, b2 = get(f'https://{d}/products.json?limit=3')
        rec['pstatus']=st2
        try:
            pj=json.loads(b2); ps=pj.get('products',[])
            rec['sample']=[{'title':p['title'],'vendor':p.get('vendor'),'type':p.get('product_type'),'price':(p.get('variants') or [{}])[0].get('price'),'img':bool(p.get('images'))} for p in ps]
        except Exception: rec['sample']=None
        out[d]=rec
        print(sec, d, st, st2, len(rec['collections'] or []), (rec['sample'] or [{}])[0].get('title') if rec['sample'] else '')
st, f, b = get('https://api.ebay.com/buy/browse/v1/item_summary/search?q=tamper')
out['_ebay']={'status':st}
os.makedirs('probe-out', exist_ok=True)
json.dump(out, open('probe-out/stores.json','w'), indent=0)
