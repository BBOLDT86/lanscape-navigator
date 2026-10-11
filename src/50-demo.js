/* ===================================================================
   The Demo Web — a small 1998-style internet that ships in the file
   =================================================================== */
const DEMO_FOOT = `
<center>
<x-webring></x-webring>
<p><font face="Arial,Helvetica" size="2">You are visitor number <x-counter></x-counter> since I put this page up!</font></p>
<p><font face="Arial,Helvetica" size="2">Last updated <x-lastmod></x-lastmod> &middot; <a href="guestbook">Sign my Guestbook</a> &middot; <a href="links">My Favorite Links</a> &middot; <a href="mailto:webmaster@example.com"><span class="spin">@</span> E-mail me</a></font></p>
</center>`;
function demoDoc(o) {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<html><head><title>${o.title}</title>
<meta name="description" content="${o.desc}">
<meta name="keywords" content="${o.kw}">${o.host ? `\n<meta name="lanscape:host" content="${o.host}">` : ''}
</head>
<body ${o.body_attrs || ''}>
${o.html}
${o.foot === false ? '' : DEMO_FOOT}
</body></html>`;
}
const DEMO_PAGES = [
  /* ---------------- cars ---------------- */
  { path: 'demo/cars/flat-six-garage.html', days: 2, d: demoDoc({
    title: "Klaus's Flat-Six Garage", host: 'www.flatsixgarage.com',
    desc: 'Restoring a 1973 air-cooled 911T coupe: valve adjustments, oil changes, carburetor sync and an engine rebuild log.',
    kw: 'air-cooled, flat-six, 911, engine rebuild, valve adjustment, carburetor, oil cooler, restoration',
    body_attrs: 'class="bg-bricks" text="#ffffff" link="#ffff66" vlink="#ffcc99"',
    html: `<center><table width="640" bgcolor="#1a1a1a" border="4" cellpadding="14"><tr><td>
<center><font face="Arial Black,Impact,Arial" size="6" color="#ff9900">Klaus's Flat-Six Garage</font><br>
<font face="Arial" size="3" color="#cccccc"><i>Air-cooled since 1973 &middot; oil on my hands, smile on my face</i></font></center>
<hr size="3" noshade>
<p><font face="Arial">Willkommen! This page is all about my <b>1973 air-cooled 911T coupe</b> and the never-ending job of keeping a flat-six engine happy. If you love the sound of six horizontally opposed cylinders and the smell of hot oil, you are in the right garage.</font></p>
<h3><font face="Arial" color="#ff9900">Maintenance Schedule</font></h3>
<table border="1" cellpadding="4" bgcolor="#333333" width="100%">
<tr bgcolor="#663300"><th><font face="Arial">Job</font></th><th><font face="Arial">Interval</font></th><th><font face="Arial">Notes</font></th></tr>
<tr><td>Valve adjustment</td><td>every 6,000 miles</td><td>Cold engine, 0.004" intake and exhaust</td></tr>
<tr><td>Oil change (11 quarts!)</td><td>every 3,000 miles</td><td>Drain the oil tank AND the engine case</td></tr>
<tr><td>Carburetor sync</td><td>yearly</td><td>Triple carburetors drift with the seasons</td></tr>
<tr><td>Oil cooler lines</td><td>inspect monthly</td><td>Weeping fittings mean trouble</td></tr>
</table>
<h3><font face="Arial" color="#ff9900">Engine Rebuild Log</font></h3>
<ul><li><b>03/14/98</b> &mdash; Dropped the engine onto a floor jack in about three hours.</li>
<li><b>04/02/98</b> &mdash; New pistons and cylinders, rebuilt heads, fresh chain tensioners.</li>
<li><b>05/20/98</b> &mdash; First start! Timing set at 5 degrees BTDC and no oil leaks (for once).</li></ul>
<p><font face="Arial">Thinking about a project car? Read the <a href="salvage-auction.html">Salvage Auction Survival Guide</a> first, then follow my buddy Rusty's <a href="rusty-project/index.html">Project Car Journal</a>. Diesel people are welcome too: visit <a href="diesel-suv-club.html">The Diesel SUV Owners Club</a>.</font></p>
<center><span class="uc"><i></i><span>PHOTO GALLERY UNDER CONSTRUCTION</span><i></i></span></center>
</td></tr></table></center>` }) },
  { path: 'demo/cars/diesel-suv-club.html', days: 9, d: demoDoc({
    title: 'The Diesel SUV Owners Club', host: 'www.dieselsuvclub.org',
    desc: 'Turbo diesel SUV owners swap towing tips, winter glow plug advice, fuel filter schedules and member rides.',
    kw: 'diesel, turbo diesel, SUV, towing, torque, glow plugs, fuel filter, intercooler, engine',
    body_attrs: 'class="bg-denim" text="#ffffff" link="#ffff00" vlink="#ffcc66"',
    html: `<center><font face="Impact,Arial Black" size="7" color="#ffcc00">The Diesel SUV Owners Club</font><br>
<font face="Arial" size="4"><i>Torque is king. Long live the turbo diesel!</i></font></center>
<marquee bgcolor="#000000" scrollamount="4"><font face="Courier New" color="#00ff00">*** CLUB MEETING SATURDAY AT THE TRUCK STOP DINER *** BRING YOUR TOWING STORIES *** NEW MEMBERS ALWAYS WELCOME ***</font></marquee>
<table width="92%" align="center" cellpadding="10"><tr><td valign="top" width="60%"><font face="Arial">
<h2>Why We Love Diesel</h2>
<p>A turbo diesel V6 SUV makes its peak torque just off idle, which means you can tow a 6,000 lb boat trailer up a mountain pass without screaming the engine. Our members regularly see <b>28 mpg on the highway</b> and 300,000 miles before a rebuild.</p>
<h2>Winter Survival</h2>
<ul><li>Cycle the <b>glow plugs</b> twice before cranking when it is below 20&deg;F.</li><li>Plug in the block heater overnight.</li><li>Add anti-gel to the fuel tank before the first freeze.</li></ul>
<h2>Maintenance Musts</h2>
<ul><li>Fuel filter every 30,000 miles (water in diesel fuel kills injectors).</li><li>Check intercooler hose clamps at every oil change.</li><li>Clean the EGR valve before it chokes the turbo.</li></ul>
</font></td><td valign="top" bgcolor="#001a33"><font face="Arial">
<h3>Member Rides</h3>
<table border="1" cellpadding="4" bgcolor="#003366"><tr><th>Member</th><th>Mods</th><th>Miles</th></tr>
<tr><td>Hank</td><td>Skid plates, tow hitch</td><td>142,000</td></tr><tr><td>Doris</td><td>Tows a 22 ft boat</td><td>98,000</td></tr>
<tr><td>Big Mike</td><td>Bigger intercooler</td><td>210,000</td></tr></table>
<p>Gas engine friends: <a href="flat-six-garage.html">Klaus's Flat-Six Garage</a> is worth a visit. Shopping for a cheap truck? Read the <a href="salvage-auction.html">Salvage Auction Survival Guide</a>.</p>
</font></td></tr></table>` }) },
  { path: 'demo/cars/salvage-auction.html', days: 14, d: demoDoc({
    title: 'Salvage Auction Survival Guide', host: 'www.salvagesurvival.com',
    desc: 'How to buy salvage-title cars at auction: title brands, buyer fees, transport, inspection checklist and a bid ceiling formula.',
    kw: 'salvage title, car auction, rebuilt title, flood damage, buyer premium, bid, inspection',
    body_attrs: 'bgcolor="#ffffff" text="#000000" link="#cc0000" vlink="#660000"',
    html: `<table width="100%" bgcolor="#cc0000"><tr><td><font face="Arial Black,Arial" size="6" color="#ffffff">&nbsp;SALVAGE AUCTION SURVIVAL GUIDE</font><br><font face="Arial" color="#ffff99">&nbsp;&nbsp;Don't get burned on a burned car.</font></td></tr></table>
<font face="Verdana,Arial" size="2">
<h3>1. Know Your Title Brands</h3>
<table border="1" cellpadding="5" cellspacing="0"><tr bgcolor="#eeeeee"><th>Title</th><th>What it means</th></tr>
<tr><td>Clean</td><td>No insurance total loss on record.</td></tr>
<tr><td>Salvage</td><td>Insurance company declared it a total loss. Cannot be driven until inspected.</td></tr>
<tr><td>Rebuilt</td><td>Repaired and passed a state salvage inspection.</td></tr>
<tr><td>Flood</td><td>Water damage. Electrical gremlins forever. Walk away.</td></tr></table>
<h3>2. The Real Cost of a $3,000 Car</h3>
<p>Winning bid + buyer premium (often 10&ndash;15%) + gate fee + internet bid fee + transport + sales tax + title fees + parts. A <b>$3,000 bid</b> easily becomes $4,600 before you turn a wrench.</p>
<h3>3. Set a Bid Ceiling</h3>
<p><tt>Max bid = retail value &minus; repair estimate &minus; all fees &minus; your profit margin</tt>. Write it down. Do not go one dollar over in the heat of the auction.</p>
<h3>4. Inspection Checklist</h3>
<ol><li>Frame rails straight? Look for kinks behind the bumpers.</li><li>Were the airbags deployed?</li><li>Water line in the trunk or a musty smell = flood car.</li><li>Rust on the seat rails and under the carpet.</li><li>Verify mileage against the title.</li></ol>
<p>Real-world project stories: <a href="rusty-project/index.html">Rusty's Project Car Journal</a> and <a href="flat-six-garage.html">Klaus's Flat-Six Garage</a>.</p></font>` }) },
  { path: 'demo/cars/rusty-project/index.html', days: 5, d: demoDoc({
    title: "Rusty's Project Car Journal", host: 'www.rustysgarage.net',
    desc: 'A weekend wrencher restores a rusty 1971 sedan: cutting out rot, MIG welding patch panels, body filler and block sanding.',
    kw: 'project car, rust repair, welding, patch panels, body filler, restoration, weekend',
    body_attrs: 'bgcolor="#e8dcc4" text="#2b1a0a" link="#8b0000" vlink="#5a3d2b"',
    html: `<center><font face="Georgia,Times" size="7" color="#8b4513"><b>Rusty's Project Car Journal</b></font><br><font face="Georgia,Times" size="4"><i>Part 1: The Rust Repair</i> &middot; <a href="paint.html">Part 2: The Paint Booth &raquo;</a></font></center>
<hr size="4" noshade color="#8b4513">
<font face="Georgia,Times" size="3">
<p>I bought this <b>1971 two-door sedan</b> for $450 from a farmer who kept chickens in it. Every Saturday since, I have been out in the garage cutting out rust and welding in new metal. This is my weekend wrenching journal.</p>
<h3>Week 1: Finding the Rot</h3><p>Poked the rocker panels with a screwdriver and it went straight through. The floor pans under the rear seat looked like lace.</p>
<h3>Week 3: Cutting and Welding</h3><p>Cut out the rust with a cutoff wheel, made patch panels from 18 gauge sheet metal, and tacked them in with my little 110V MIG welder. Tip: stitch weld and let it cool so the panel does not warp.</p>
<h3>Week 6: Body Filler</h3><p>Seam sealer on every joint, a skim coat of body filler, then hours of block sanding with 80 and 180 grit. My arms are dead.</p>
<p><a href="paint.html">Continue to Part 2: building a garage paint booth &raquo;</a></p>
<p>Friends with nicer cars: <a href="../flat-six-garage.html">Klaus's Flat-Six Garage</a> &middot; <a href="../salvage-auction.html">Salvage Auction Survival Guide</a></p></font>` }) },
  { path: 'demo/cars/rusty-project/paint.html', days: 4, d: demoDoc({
    title: "Rusty's Project Car Journal - Part 2: Paint",
    desc: 'Building a garage paint booth with plastic sheeting and box fans, then primer, base coat, clear coat and wet sanding.',
    kw: 'car paint, paint booth, primer, clear coat, wet sanding, orange peel',
    body_attrs: 'bgcolor="#e8dcc4" text="#2b1a0a" link="#8b0000" vlink="#5a3d2b"',
    html: `<center><font face="Georgia,Times" size="6" color="#8b4513"><b>Part 2: My Garage Paint Booth</b></font><br><a href="index.html">&laquo; Back to Part 1: Rust Repair</a></center><hr size="4" noshade color="#8b4513">
<font face="Georgia,Times" size="3"><p>You do not need a professional booth to lay down decent paint. Here is what worked for my sedan:</p>
<ol><li>Hang plastic sheeting from the ceiling to make a tent around the car.</li><li>Two box fans with furnace filters taped on: one blowing in, one blowing out.</li><li>Wet the floor so dust stays down.</li></ol>
<h3>Sanding Grits</h3><p>320 on the body filler, 400 on the primer, 600 before base coat, then wet sanding the clear coat with 1500 and 2000 to knock down orange peel. Finish with polishing compound and a buffer.</p>
<h3>The Paint</h3><p>Two coats of epoxy primer, three coats of base coat (Highland Green), and three coats of clear coat. Total cost about $400 in materials.</p>
<center><span class="uc"><i></i><span>MORE PHOTOS SOON</span><i></i></span></center></font>` }) },

  /* ---------------- poker ---------------- */
  { path: 'demo/poker/river-card.html', days: 3, d: demoDoc({
    title: "The River Card: Texas Hold'em Strategy", host: 'www.therivercard.com',
    desc: "Texas Hold'em strategy for beginners: starting hands, position, pot odds, outs, bluffing on the river and bankroll management.",
    kw: "texas hold'em, poker strategy, starting hands, position, pot odds, outs, bluff, bankroll",
    body_attrs: 'bgcolor="#0b5d1e" text="#ffffff" link="#ffd700" vlink="#ffeb99"',
    html: `<center><font face="Georgia,Times" size="7" color="#ffd700"><b>&spades; The River Card &hearts;</b></font><br><font face="Georgia" size="4"><i>Texas Hold'em strategy from the felt</i></font></center>
<hr size="2" noshade>
<table width="90%" align="center" cellpadding="8"><tr><td><font face="Arial">
<h2>Starting Hands</h2><p>Play tight in early position: pocket pairs AA through 99, AK, AQ suited. From the <b>button</b> and the cutoff you can open up with suited connectors and small pairs. Fold garbage from the blinds and live to play another hand.</p>
<h2>Position Is Power</h2><p>Acting last lets you see what everyone else does first. The button is the best seat at the table, the small blind is the worst.</p>
<h2>Pot Odds and Outs</h2><p>Count your <b>outs</b> (cards that make your hand), then compare your chance to hit against the price the pot is offering. Use the <a href="outs-calculator.html">Pot Odds &amp; Outs Calculator</a> until it becomes second nature.</p>
<h2>Bluffing the River</h2><p>A river bluff works best when your betting tells a believable story and your opponent has a capped range. Never bluff a calling station.</p>
<h2>Bankroll</h2><p>Keep at least 20 buy-ins for your limit. Going broke is not a strategy.</p>
<p>More: <a href="tournament-tips.html">Tournament Survival Tips</a> &middot; <a href="vegas-trip-98/index.html">Big Al's Vegas Trip Report</a></p></font></td></tr></table>` }) },
  { path: 'demo/poker/outs-calculator.html', days: 21, d: demoDoc({
    title: 'Pot Odds & Outs Calculator', host: 'www.outscalc.com',
    desc: 'A working JavaScript calculator for poker outs: exact odds to hit on the turn or river plus the rule of 4 and 2.',
    kw: 'poker outs, pot odds calculator, flush draw, straight draw, gutshot, rule of 4 and 2',
    body_attrs: 'bgcolor="#000000" text="#33ff33" link="#00ffff" vlink="#66cccc"',
    html: `<center><font face="Courier New,Courier" size="6"><b>POT ODDS &amp; OUTS CALCULATOR v1.2</b></font><br><font face="Courier New">( requires a JavaScript-capable browser )</font></center>
<form name="f" onsubmit="return calc()"><center><table border="2" cellpadding="8" bgcolor="#002200"><tr><td><font face="Courier New">
Outs: <select name="outs">${Array.from({ length: 20 }, (_, i) => `<option${i + 1 === 9 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
&nbsp; <label><input type="radio" name="cards" value="2" checked> Flop to river</label> <label><input type="radio" name="cards" value="1"> Turn to river</label>
&nbsp; <input type="submit" value="CALCULATE"></font></td></tr></table>
<p id="out"><font face="Courier New">Pick your outs and press CALCULATE.</font></p></center></form>
<script>function calc(){var o=+document.f.outs.value,n=+document.querySelector('input[name=cards]:checked').value;var p=n===1?o/46:1-((47-o)/47)*((46-o)/46);document.getElementById('out').innerHTML='<font face="Courier New" size="4">Exact: <b>'+(p*100).toFixed(1)+'%</b> &nbsp; Rule of '+(n===1?'2':'4')+': '+Math.min(100,o*(n===1?2:4))+'%</font>';return false;}<\/script>
<center><table border="1" cellpadding="5"><tr><th>Draw</th><th>Outs</th><th>Flop to river</th></tr>
<tr><td>Flush draw</td><td>9</td><td>35.0%</td></tr><tr><td>Open-ended straight draw</td><td>8</td><td>31.5%</td></tr>
<tr><td>Two overcards</td><td>6</td><td>24.1%</td></tr><tr><td>Gutshot straight draw</td><td>4</td><td>16.5%</td></tr>
<tr><td>Set to full house or quads</td><td>7</td><td>33.4%</td></tr></table></center>
<p><font face="Courier New">Strategy reading: <a href="river-card.html">The River Card</a>.</font></p>` }) },
  { path: 'demo/poker/vegas-trip-98/index.html', days: 30, d: demoDoc({
    title: "Big Al's Vegas Trip Report '98", host: 'www.bigalsvegas.com',
    desc: "Day 1 of Big Al's Las Vegas trip: the Strip, $2/$4 limit hold'em, the seafood buffet, comps and a cold craps table.",
    kw: "las vegas, trip report, poker room, limit hold'em, buffet, comps, craps, the strip",
    body_attrs: 'class="bg-stars" text="#ffffff" link="#ff66ff" vlink="#cc99ff"',
    html: `<center><font face="Impact,Arial Black" size="7" color="#ff00ff">BIG AL'S VEGAS TRIP REPORT '98</font><br>
<font face="Arial" size="4" color="#00ffff">Day 1 &middot; <a href="day2.html">Day 2: The Tournament &raquo;</a></font></center>
<marquee scrollamount="6"><font face="Arial Black" color="#ffff00" size="5">&diams; WHAT HAPPENS IN VEGAS GETS POSTED ON MY HOMEPAGE &diams;</font></marquee>
<font face="Arial"><p>Flew in Thursday night and the <b>Strip</b> was lit up like a pinball machine. Checked in, dropped my bag and went straight to the <b>poker room</b>.</p>
<h3>The Poker</h3><p>Sat down at a $2/$4 limit hold'em game full of tourists. Won three big pots with top pair and lost one to a guy who called down with bottom pair. Up $86 after four hours.</p>
<h3>The Buffet</h3><p>$9.99 seafood buffet with crab legs and prime rib. Went back for thirds. No regrets.</p>
<h3>Comps</h3><p>Asked the floor for a comp after my session and got two buffet passes. Always ask!</p>
<h3>Craps</h3><p>Lost $60 at the craps table in about eleven minutes. The dice hate me.</p>
<p>Planning your own trip? Read <a href="../river-card.html">The River Card</a> and check the miles at <a href="http://www.milesandpoints.net/">Frequent Flyer Points Corner</a>.</p></font>` }) },
  { path: 'demo/poker/vegas-trip-98/day2.html', days: 29, d: demoDoc({
    title: "Big Al's Vegas Trip Report - Day 2: The Tournament",
    desc: 'Day 2: a $60 daily poker tournament with 112 players, rising blinds, a short stack, the bubble and a three-way chop at the final table.',
    kw: 'poker tournament, final table, blinds, chip stack, bubble, chop, vegas',
    body_attrs: 'class="bg-stars" text="#ffffff" link="#ff66ff" vlink="#cc99ff"',
    html: `<center><font face="Impact,Arial Black" size="6" color="#ff00ff">DAY 2: THE DAILY TOURNAMENT</font><br><a href="index.html">&laquo; Back to Day 1</a></center>
<font face="Arial"><p>The noon <b>tournament</b>: $60 buy-in, 112 players, blinds up every 20 minutes. I started with 2,000 in chips.</p>
<h3>Level 4: Short Stack</h3><p>Down to 8 big blinds after my kings ran into aces. Shoved all-in from the cutoff with A-9 and doubled up.</p>
<h3>The Bubble</h3><p>Eleven players left, ten paid. Everybody tightened up so I stole the blinds four orbits in a row.</p>
<h3>The Final Table</h3><p>Made the <b>final table</b> fourth in chips. With three players left we agreed to a chop and I walked out with $1,450. Best poker day of my life!</p>
<p>Want to go deep? Study <a href="../tournament-tips.html">Tournament Survival Tips</a>.</p></font>` }) },
  { path: 'demo/poker/tournament-tips.html', days: 11, d: demoDoc({
    title: 'Tournament Survival Tips', host: 'www.tourneytips.com',
    desc: 'Poker tournament survival: blind levels and antes, the M-ratio zones, push/fold under ten big blinds, bubble play and final table deals.',
    kw: 'poker tournament, blinds, antes, M ratio, push fold, bubble, final table, chop',
    body_attrs: 'bgcolor="#1c1c3c" text="#e8e8ff" link="#ffcc00" vlink="#ff9966"',
    html: `<center><font face="Georgia,Times" size="6" color="#ffcc00"><b>Tournament Survival Tips</b></font><br><font face="Georgia"><i>How to last longer than the free buffet</i></font></center><hr>
<font face="Verdana,Arial" size="2"><h3>Know Your M</h3><p>M = your chip stack &divide; (small blind + big blind + antes). It tells you how many orbits you can survive without playing a hand.</p>
<table border="1" cellpadding="4" align="center"><tr><th>Zone</th><th>M</th><th>Strategy</th></tr>
<tr><td bgcolor="#006600">Green</td><td>20+</td><td>Play real poker</td></tr><tr><td bgcolor="#999900">Yellow</td><td>10&ndash;20</td><td>Stop limping, steal more</td></tr>
<tr><td bgcolor="#cc6600">Orange</td><td>6&ndash;10</td><td>Raise or fold, no calling</td></tr><tr><td bgcolor="#990000">Red</td><td>1&ndash;5</td><td>Push or fold only</td></tr></table>
<h3>Push/Fold Under 10 Big Blinds</h3><p>With a short stack, moving all-in preflop gives you fold equity. Calling raises with a short stack gives you none.</p>
<h3>The Bubble</h3><p>Medium stacks tighten up near the money. Big stacks should attack them relentlessly.</p>
<h3>Final Table Deals</h3><p>A chop can be by chip count or by payout models. Know the numbers before you agree.</p>
<p>Real story: <a href="vegas-trip-98/day2.html">Big Al's tournament day</a>. Basics: <a href="river-card.html">The River Card</a>.</p></font>` }) },

  /* ---------------- cooking ---------------- */
  { path: 'demo/cooking/grandma-ruth/index.html', days: 6, d: demoDoc({
    title: "Grandma Ruth's Recipe Box", host: 'www.grandmaruth.com',
    desc: "Family recipes from Grandma Ruth's kitchen since 1952: apple pie, buttermilk biscuits, pot roast and more.",
    kw: 'family recipes, grandma, apple pie, biscuits, pot roast, baking, kitchen',
    body_attrs: 'class="bg-paper" text="#3b2410" link="#a0522d" vlink="#6b3a1f"',
    html: `<center><font face="Georgia,Times" size="7" color="#8b2500"><i>Grandma Ruth's Recipe Box</i></font><br><font face="Georgia" size="4">~ family recipes since 1952 ~</font></center>
<hr size="2" color="#8b2500">
<table width="80%" align="center"><tr><td><font face="Georgia" size="4">
<p>Welcome to my kitchen! My grandson set up this homepage so I could share the recipes everyone asks me for at Thanksgiving. Ruth says: <b>"Cold butter, warm heart."</b></p>
<h3>The Recipe Box</h3>
<ul><li><a href="apple-pie.html">Ruth's Lattice Apple Pie</a> <span class="newbadge">NEW!</span></li>
<li><a href="biscuits.html">Buttermilk Biscuits</a></li><li>Sunday Pot Roast <i>(coming soon)</i></li><li>Chicken &amp; Dumplings <i>(coming soon)</i></li></ul>
<p>My neighbor's grandson smokes a mean brisket over at <a href="../smoke-ring-bbq.html">Smoke Ring BBQ Pit</a>, and every kitchen needs a skillet from <a href="../cast-iron-corner.html">Cast Iron Corner</a>.</p>
</font></td></tr></table>` }) },
  { path: 'demo/cooking/grandma-ruth/apple-pie.html', days: 1, d: demoDoc({
    title: "Ruth's Lattice Apple Pie",
    desc: 'Grandma Ruth apple pie recipe: all-butter crust, seven apples, cinnamon and nutmeg, lattice top, baked at 425 then 350.',
    kw: 'apple pie recipe, pie crust, lattice, baking, cinnamon, dessert',
    body_attrs: 'class="bg-paper" text="#3b2410" link="#a0522d" vlink="#6b3a1f"',
    html: `<center><font face="Georgia" size="6" color="#8b2500"><i>Ruth's Lattice Apple Pie</i></font><br><a href="index.html">&laquo; back to the Recipe Box</a></center><hr size="2" color="#8b2500">
<table width="80%" align="center"><tr><td valign="top"><font face="Georgia" size="3"><h3>Crust</h3><ul><li>2&frac12; cups flour</li><li>1 cup very cold butter, cubed</li><li>1 tsp salt</li><li>6&ndash;8 tbsp ice water</li></ul>
<h3>Filling</h3><ul><li>7 apples (half Granny Smith, half sweet)</li><li>&frac34; cup sugar</li><li>1 tsp cinnamon, pinch of nutmeg</li><li>Juice of half a lemon</li><li>3 tbsp flour</li></ul></font></td>
<td valign="top"><font face="Georgia" size="3"><h3>Method</h3><ol><li>Cut the butter into the flour until it looks like peas. Add ice water until the dough holds. Chill one hour.</li>
<li>Slice the apples thin and toss with sugar, spices, lemon and flour.</li><li>Roll out the bottom crust, fill it heaping high, then weave a lattice top.</li>
<li>Bake at <b>425&deg;F for 15 minutes</b>, then 350&deg;F for 45 minutes until the filling bubbles.</li><li>Cool at least 4 hours. Ruth means it.</li></ol></font></td></tr></table>` }) },
  { path: 'demo/cooking/grandma-ruth/biscuits.html', days: 40, d: demoDoc({
    title: 'Buttermilk Biscuits',
    desc: 'Flaky buttermilk biscuits: cold butter, three folds for layers, baked at 450 degrees in a cast iron skillet.',
    kw: 'biscuits, buttermilk, baking, cast iron, breakfast, recipe',
    body_attrs: 'class="bg-paper" text="#3b2410" link="#a0522d" vlink="#6b3a1f"',
    html: `<center><font face="Georgia" size="6" color="#8b2500"><i>Buttermilk Biscuits</i></font><br><a href="index.html">&laquo; back to the Recipe Box</a></center><hr size="2" color="#8b2500">
<table width="70%" align="center"><tr><td><font face="Georgia" size="3"><ul><li>2 cups flour, 1 tbsp baking powder, &frac14; tsp baking soda, 1 tsp salt</li><li>6 tbsp cold butter, grated</li><li>&frac34; cup cold buttermilk</li></ul>
<ol><li>Grate the butter into the dry ingredients and toss.</li><li>Stir in the buttermilk just until shaggy.</li><li>Pat out and fold in thirds three times for flaky layers.</li><li>Cut straight down (no twisting!) and crowd them in a buttered <a href="../cast-iron-corner.html">cast iron skillet</a>.</li><li>Bake at 450&deg;F for 12 minutes.</li></ol></font></td></tr></table>` }) },
  { path: 'demo/cooking/sourdough.html', days: 17, d: demoDoc({
    title: 'The Sourdough Starter Page', host: 'www.sourdoughstarter.org',
    desc: 'Keep a sourdough starter alive and bake an open-crumb loaf: feeding ratios, hydration, stretch and folds, Dutch oven baking and scoring.',
    kw: 'sourdough, starter, levain, bread baking, hydration, dutch oven, oven spring, flour',
    body_attrs: 'bgcolor="#fdf5e6" text="#3a2a1a" link="#b8860b" vlink="#8b6914"',
    html: `<center><font face="Times New Roman" size="7"><b>The Sourdough Starter Page</b></font><br><font face="Times New Roman" size="4"><i>Home of Clint Yeastwood, a starter born in 1994</i></font></center><hr>
<font face="Times New Roman" size="4"><h3>Feeding Your Starter</h3><p>Feed 1:1:1 &mdash; equal weights of starter, flour and water &mdash; once a day on the counter, or once a week from the fridge. A happy starter doubles in 4 to 6 hours and smells like yogurt.</p>
<h3>Hydration</h3><p>Hydration is water weight divided by flour weight. 70% is easy to handle; 80% gives an open, glossy crumb but sticky dough.</p>
<h3>The Bake</h3><ol><li>Mix the levain, flour, water and salt.</li><li>Bulk ferment 4&ndash;6 hours with four sets of stretch and folds.</li><li>Shape, put it in a banneton, and retard overnight in the fridge.</li><li>Preheat a Dutch oven to 500&deg;F. Score the loaf and bake 20 minutes lid on, 25 lid off.</li></ol>
<p>Good <b>oven spring</b> means your starter was strong and your shaping was tight. Pair your bread with <a href="grandma-ruth/index.html">Grandma Ruth's recipes</a>.</p></font>` }) },
  { path: 'demo/cooking/smoke-ring-bbq.html', days: 8, d: demoDoc({
    title: 'Smoke Ring BBQ Pit', host: 'www.smokeringbbq.com',
    desc: 'Low and slow barbecue: smoking brisket at 225, hickory and oak, surviving the stall, butcher paper wraps, rub recipe and 3-2-1 ribs.',
    kw: 'bbq, barbecue, brisket, smoker, smoke ring, ribs, pulled pork, rub, hickory',
    body_attrs: 'class="bg-wood" text="#fff3d6" link="#ffb347" vlink="#ffd9a0"',
    html: `<center><font face="Impact,Arial Black" size="7" color="#ff6600">SMOKE RING BBQ PIT</font><br><font face="Arial" size="4"><i>Low and slow or don't bother</i></font></center><hr size="3" noshade>
<table width="88%" align="center" cellpadding="6"><tr><td><font face="Arial">
<h2>Brisket 101</h2><p>Trim the fat cap to a quarter inch, season with the rub below, and smoke at <b>225&ndash;250&deg;F</b> over hickory or post oak. Expect about 1&frac12; hours per pound.</p>
<h2>The Stall</h2><p>Around 160&deg;F internal the temperature stops climbing for hours while moisture evaporates. Don't panic. Wrap it in butcher paper to push through, then pull it at 203&deg;F probe tender.</p>
<h2>Rub Recipe</h2><ul><li>4 tbsp coarse black pepper</li><li>4 tbsp kosher salt</li><li>1 tbsp garlic powder</li><li>1 tsp paprika</li></ul>
<h2>Ribs: 3-2-1</h2><p>3 hours of smoke, 2 hours wrapped, 1 hour sauced. Fall-off-the-bone every time.</p>
<p>Cornbread on the side? Get a skillet from <a href="cast-iron-corner.html">Cast Iron Corner</a>.</p></font></td></tr></table>` }) },
  { path: 'demo/cooking/cast-iron-corner.html', days: 25, d: demoDoc({
    title: 'Cast Iron Corner', host: 'www.castironcorner.com',
    desc: 'Seasoning and caring for a cast iron skillet, cleaning with coarse salt, skillet cornbread and a camping Dutch oven cobbler.',
    kw: 'cast iron, skillet, seasoning, cornbread, dutch oven, cooking, camping',
    body_attrs: 'bgcolor="#2b2b2b" text="#eeeeee" link="#ff9966" vlink="#cc9977"',
    html: `<center><font face="Georgia" size="7" color="#ff9966"><b>Cast Iron Corner</b></font><br><font face="Georgia" size="4">Your grandmother's skillet deserves better</font></center><hr>
<font face="Verdana,Arial" size="2"><h3>Seasoning a Skillet</h3><ol><li>Scrub it, dry it completely on a warm burner.</li><li>Rub in a very thin coat of oil, then wipe it all off as if you made a mistake.</li><li>Bake upside down at 450&deg;F for one hour. Repeat three times.</li></ol>
<h3>Cleaning</h3><p>Coarse salt and a paper towel take care of almost anything. Never soak it and never put it in the dishwasher.</p>
<h3>Skillet Cornbread</h3><p>Preheat the skillet with bacon grease in a 425&deg;F oven, pour in the batter so it sizzles, bake 20 minutes. Crispy edges every time.</p>
<h3>Camping Dutch Oven Cobbler</h3><p>Peaches in the bottom, cake mix on top, 8 coals under and 16 on the lid for 45 minutes.</p>
<p>See also: <a href="smoke-ring-bbq.html">Smoke Ring BBQ Pit</a> &middot; <a href="grandma-ruth/biscuits.html">Ruth's Buttermilk Biscuits</a></p></font>` }) },

  /* ---------------- travel ---------------- */
  { path: 'demo/travel/caribbean-cruise-log.html', days: 12, d: demoDoc({
    title: 'Our Caribbean Cruise Log', host: 'www.cruiselog98.com',
    desc: 'Seven nights in the Western Caribbean: embarkation, muster drill, a balcony cabin, sea days, formal night, Cozumel snorkeling and a Grand Cayman tender.',
    kw: 'caribbean cruise, cruise ship, balcony cabin, sea day, ports, shore excursion, snorkeling, tender, buffet',
    body_attrs: 'class="bg-water" text="#ffffff" link="#ffff66" vlink="#ccffcc"',
    html: `<center><font face="Georgia" size="7" color="#ffffff"><b>Our Caribbean Cruise Log</b></font><br><font face="Georgia" size="4" color="#aaffff"><i>Seven nights aboard the MS Sapphire Dawn</i></font></center>
<marquee scrollamount="3"><font face="Arial" color="#ffff66">~ ~ ~ sea days, sunsets and way too much buffet ~ ~ ~</font></marquee>
<table width="86%" align="center" bgcolor="#003355" cellpadding="12" border="2"><tr><td><font face="Arial">
<h3>Day 1: Embarkation</h3><p>Checked in at the port by noon, ate lunch at the buffet before our cabin was ready, and did the muster drill with our life jackets on at 4. Sail-away party on the pool deck!</p>
<h3>Day 2: Sea Day</h3><p>Our <b>balcony cabin</b> on deck 9 was worth every penny. Spent the morning on the balcony and the afternoon at the pool. Formal night: lobster and baked Alaska.</p>
<h3>Day 3: Cozumel</h3><p>Booked a snorkeling shore excursion to the reef. Saw a sea turtle and a hundred parrotfish.</p>
<h3>Day 4: Grand Cayman</h3><p>A tender port, so we rode a little boat to shore. Swam with stingrays on the sandbar.</p>
<h3>Day 7: Disembarkation</h3><p>Bags out the night before, off the ship by 9 am. Already planning the next cruise.</p>
<p>Island tips: <a href="island-hopper.html">The Island Hopper's Guide</a>. Paid for the flights with miles from <a href="points-corner.html">Frequent Flyer Points Corner</a>.</p></font></td></tr></table>` }) },
  { path: 'demo/travel/island-hopper.html', days: 19, d: demoDoc({
    title: "The Island Hopper's Guide", host: 'www.islandhopper.com',
    desc: 'Caribbean island hopping: the best beaches and snorkeling reefs, ferry schedules, rum punch, hurricane season and a packing list.',
    kw: 'caribbean islands, beaches, snorkeling, ferry, island hopping, hurricane season, packing list, travel',
    body_attrs: 'class="bg-clouds" text="#002244" link="#cc0066" vlink="#880044"',
    html: `<center><font face="Comic Sans MS,Arial" size="7" color="#cc0066"><b>The Island Hopper's Guide</b></font><br><font face="Comic Sans MS,Arial" size="4">Sand between your toes since 1996</font></center>
<table width="80%" align="center" bgcolor="#ffffff" cellpadding="12" border="1"><tr><td><font face="Arial" size="3">
<h3>Best Beaches</h3><ul><li>White sand on the north shores, calm turquoise water on the leeward side.</li><li>Get there before the cruise ship crowds at 10 am.</li></ul>
<h3>Snorkeling Reefs</h3><p>Shallow reefs right off the beach are the best snorkeling. Bring your own mask and fins; rentals leak.</p>
<h3>Ferry Schedules</h3><p>Inter-island ferries run on island time. Always confirm the last boat back the day before.</p>
<h3>Hurricane Season</h3><p>June through November. Travel insurance is your friend.</p>
<h3>Packing List</h3><ul><li>Reef-safe sunscreen</li><li>Water shoes</li><li>Snorkel mask</li><li>Rain jacket</li><li>Cash for the rum punch stand</li></ul>
<p>Read a real voyage: <a href="caribbean-cruise-log.html">Our Caribbean Cruise Log</a>.</p></font></td></tr></table>` }) },
  { path: 'demo/travel/points-corner.html', days: 7, d: demoDoc({
    title: 'Frequent Flyer Points Corner', host: 'www.milesandpoints.net',
    desc: 'Frequent flyer miles and hotel points: award charts, saver awards, upgrades, elite status tiers, card sign-up bonuses and transfers.',
    kw: 'frequent flyer, miles, points, award travel, upgrades, elite status, hotel points, credit card bonus',
    body_attrs: 'bgcolor="#ffffff" text="#000033" link="#0000cc" vlink="#551a8b"',
    html: `<table width="100%" bgcolor="#000066" cellpadding="8"><tr><td><font face="Arial Black,Arial" size="6" color="#ffcc00">&#9992; Frequent Flyer Points Corner</font><br><font face="Arial" color="#ffffff">Fly first class on someone else's dime</font></td></tr></table>
<font face="Arial" size="3"><h3>Saver Awards</h3><p>Every airline publishes an award chart. Saver awards cost the fewest miles but have limited seats, so book 11 months out or at the last minute.</p>
<h3>Upgrades</h3><p>Upgrading with miles usually requires a full-fare ticket. Elite status upgrades clear at the gate in order of tier.</p>
<h3>Elite Status Tiers</h3><table border="1" cellpadding="4"><tr><th>Tier</th><th>Miles flown</th><th>Perks</th></tr>
<tr><td>Silver</td><td>25,000</td><td>Free bags, better seats</td></tr><tr><td>Gold</td><td>50,000</td><td>Lounge passes, upgrades</td></tr><tr><td>Platinum</td><td>75,000</td><td>Everything, and a warm cookie</td></tr></table>
<h3>Hotel Points</h3><p>Hotel points are worth less per point but rack up fast. Stack them with a co-branded card sign-up bonus.</p>
<p>Where to spend them: <a href="caribbean-cruise-log.html">a Caribbean cruise</a> or a comped weekend like <a href="../poker/vegas-trip-98/index.html">Big Al's Vegas trip</a>.</p></font>` }) },

  /* ---------------- tech ---------------- */
  { path: 'demo/tech/build-your-own-pc.html', days: 35, d: demoDoc({
    title: "Build Your Own PC '98", host: 'www.buildapc98.com',
    desc: 'Build a 1998 PC: 300 MHz CPU, ATX motherboard, 64MB SDRAM, power supply wattage, IDE master/slave jumpers, AGP video and BIOS setup.',
    kw: 'build pc, motherboard, cpu, ram, power supply, ide, jumpers, bios, video card, modem',
    body_attrs: 'bgcolor="#000080" text="#ffffff" link="#ffff00" vlink="#c0c0c0"',
    html: `<center><font face="Courier New" size="6"><b>BUILD YOUR OWN PC '98</b></font><br><font face="Courier New">C:\\&gt; save $500 and learn something_</font></center><hr>
<font face="Courier New" size="3"><h3>The Parts List</h3><table border="1" cellpadding="4"><tr><th>Part</th><th>Pick</th><th>Price</th></tr>
<tr><td>CPU</td><td>300 MHz, slot 1</td><td>$289</td></tr><tr><td>Motherboard</td><td>ATX, BX chipset</td><td>$129</td></tr>
<tr><td>RAM</td><td>64MB SDRAM</td><td>$79</td></tr><tr><td>Hard drive</td><td>6.4 GB IDE</td><td>$189</td></tr>
<tr><td>Video card</td><td>8MB AGP</td><td>$119</td></tr><tr><td>Power supply</td><td>300 watt ATX</td><td>$45</td></tr><tr><td>Modem</td><td>56K</td><td>$89</td></tr></table>
<h3>Assembly Tips</h3><ol><li>Ground yourself before touching the motherboard.</li><li>Set the IDE jumpers: hard drive is master, CD-ROM is slave.</li><li>Do not skimp on the power supply. A cheap one will take the rest of the system with it.</li><li>Enter the BIOS setup and let it detect your drives.</li></ol>
<p>Protect it from brownouts with a battery backup: <a href="ups-corner.html">The UPS &amp; Battery Backup Corner</a>.</p></font>` }) },
  { path: 'demo/tech/ups-corner.html', days: 10, d: demoDoc({
    title: 'The UPS & Battery Backup Corner', host: 'www.upscorner.net',
    desc: 'Uninterruptible power supplies explained: standby, line-interactive and online double-conversion topologies, VRLA batteries, runtime and VA vs watts.',
    kw: 'ups, uninterruptible power supply, battery backup, inverter, rectifier, static bypass, vrla battery, runtime, power factor',
    body_attrs: 'bgcolor="#f0f0f0" text="#000000" link="#0033cc" vlink="#663399"',
    html: `<table width="100%" bgcolor="#003399" cellpadding="8"><tr><td><font face="Arial Black,Arial" size="6" color="#ffffff">&#9889; The UPS &amp; Battery Backup Corner</font><br><font face="Arial" color="#ccddff">Because the lights always go out at the worst moment</font></td></tr></table>
<font face="Arial" size="3"><h3>What a UPS Does</h3><p>An <b>uninterruptible power supply</b> keeps your equipment running from a battery when utility power fails, and cleans up sags, surges and noise while the power is on.</p>
<h3>Three Topologies</h3><table border="1" cellpadding="5" cellspacing="0"><tr bgcolor="#dddddd"><th>Topology</th><th>Transfer time</th><th>Best for</th></tr>
<tr><td>Standby (offline)</td><td>4&ndash;10 ms</td><td>Home PCs</td></tr><tr><td>Line-interactive</td><td>2&ndash;4 ms</td><td>Small servers</td></tr>
<tr><td>Online double-conversion</td><td>0 ms</td><td>Critical loads</td></tr></table>
<p>In an <b>online double-conversion</b> UPS the rectifier feeds a DC bus, the batteries float on that bus, and the inverter rebuilds clean AC. A static bypass switch carries the load if the inverter faults, and a maintenance bypass lets you service the unit without dropping the load.</p>
<h3>Batteries and Runtime</h3><p>Most small units use sealed VRLA lead-acid batteries. Expect about five years at 77&deg;F; every 15&deg;F hotter cuts that life in half. Runtime depends on load watts, battery amp-hours and inverter efficiency.</p>
<h3>VA vs Watts</h3><p>Watts = VA &times; power factor. A 1500 VA unit at 0.9 power factor supports 1350 watts.</p>
<p>Building a new computer? Size your power supply at <a href="build-your-own-pc.html">Build Your Own PC '98</a>.</p></font>` }) },
  { path: 'demo/tech/html-for-beginners.html', days: 45, d: demoDoc({
    title: 'HTML for Beginners', host: 'www.htmlbeginners.edu',
    desc: 'Learn HTML in an afternoon: tags, tables, frames, font colors in hex, blink and marquee, view source, uploading with FTP, guestbooks, counters and web rings.',
    kw: 'html tutorial, web design, tags, tables, frames, hex colors, marquee, blink, homepage, web ring',
    body_attrs: 'bgcolor="#ffffcc" text="#000000" link="#0000ff" vlink="#800080"',
    html: `<center><font face="Times New Roman" size="7"><b>HTML for Beginners</b></font><br><font size="4"><blink>Make your own homepage TODAY!</blink></font></center><hr class="rainbow">
<font face="Times New Roman" size="4"><h3>Lesson 1: Tags</h3><p>HTML is just text with <tt>&lt;TAGS&gt;</tt>. Bold is <tt>&lt;B&gt;</tt>, italics is <tt>&lt;I&gt;</tt>, and every tag you open you should close.</p>
<h3>Lesson 2: Colors</h3><p>Colors are written in hex: <font color="#ff0000">#FF0000 is red</font>, <font color="#008000">#008000 is green</font>, <font color="#0000ff">#0000FF is blue</font>.</p>
<h3>Lesson 3: Tables and Frames</h3><p>Tables lay out your whole page. Frames split the window into panes, but search engines hate them.</p>
<h3>Lesson 4: Motion!</h3><marquee bgcolor="#000000"><font color="#00ff00" face="Courier New">This is a marquee. Use it sparingly. Nobody will.</font></marquee>
<h3>Lesson 5: Get Visitors</h3><p>Add a hit counter, a guestbook, and join a web ring at <a href="http://www.ringhub.org/">RingHub</a>. Submit your site to <a href="http://www.hyperhound.com/">HyperHound</a>.</p>
<h3>Homework</h3><ul><li>Visit my old homepage at <a href="http://www.myoldhomepage.com/">www.myoldhomepage.com</a> (it moved, see what happens).</li>
<li>Try my <a href="guestbook.cgi">old CGI guestbook</a> (broken link, on purpose).</li><li>Read the real rules at the <a href="https://www.w3.org/">W3C</a>.</li></ul>
<p>Want to build the computer too? <a href="build-your-own-pc.html">Build Your Own PC '98</a>.</p></font>` }) },

  /* ---------------- horses ---------------- */
  { path: 'demo/horses/hoofbeats-dressage.html', days: 16, d: demoDoc({
    title: 'Hoofbeats Dressage Page', host: 'www.hoofbeatsdressage.com',
    desc: 'Dressage basics: the training scale, arena letters, Training and First Level tests, movement scores from 0 to 10 and collective marks.',
    kw: 'dressage, horse, training scale, arena letters, dressage test, collective marks, riding',
    body_attrs: 'bgcolor="#fffaf0" text="#1f3b1f" link="#8b0000" vlink="#5a2d0c"',
    html: `<center><font face="Georgia" size="7" color="#2e5e2e"><i>Hoofbeats Dressage</i></font><br><font face="Georgia" size="4">&#9822; ride every corner &#9822;</font></center><hr size="2" color="#2e5e2e">
<font face="Georgia" size="3"><h3>The Training Scale</h3><ol><li>Rhythm</li><li>Suppleness</li><li>Contact</li><li>Impulsion</li><li>Straightness</li><li>Collection</li></ol>
<h3>Arena Letters</h3><p>A small arena is lettered A K E H C M B F around the rail. Remember: <b>A</b>ll <b>K</b>ind <b>E</b>lephants <b>H</b>ave <b>C</b>ute <b>M</b>ini <b>B</b>aby <b>F</b>eet.</p>
<h3>Scoring a Test</h3><p>Each movement in a dressage test is scored from 0 to 10 by the judge. The collective marks score gaits, impulsion, submission and rider position, and some are worth double.</p>
<table border="1" cellpadding="4"><tr><th>Score</th><th>Meaning</th></tr><tr><td>10</td><td>Excellent</td></tr><tr><td>7</td><td>Fairly good</td></tr><tr><td>5</td><td>Sufficient</td></tr><tr><td>3</td><td>Fairly bad</td></tr></table>
<p>Taking care of your partner: <a href="barn-chores.html">Barn Chores &amp; Horse Care</a>.</p></font>` }) },
  { path: 'demo/horses/barn-chores.html', days: 22, d: demoDoc({
    title: 'Barn Chores & Horse Care', host: 'www.barnchores.org',
    desc: 'Daily barn routine for horse owners: hay and grain, fresh water, mucking stalls, grooming kit, farrier visits, vaccinations and turnout.',
    kw: 'horse care, barn, hay, mucking stalls, grooming, farrier, hooves, vaccinations, turnout',
    body_attrs: 'class="bg-grass" text="#ffffff" link="#ffff99" vlink="#ffe0a0"',
    html: `<center><font face="Arial Black,Arial" size="6" color="#ffff99">BARN CHORES &amp; HORSE CARE</font><br><font face="Arial" size="3">Up at 5:30 so the horses don't have to wait</font></center>
<table width="80%" align="center" bgcolor="#1f4a1a" cellpadding="10" border="2"><tr><td><font face="Arial" size="3">
<h3>Feeding</h3><p>A horse eats about 2% of its body weight in hay every day. Grain only if the work demands it. Fresh water, always.</p>
<h3>Mucking Stalls</h3><p>Pick out manure and wet spots every morning and lay fresh shavings. A clean stall keeps hooves healthy.</p>
<h3>The Grooming Kit</h3><ul><li>Curry comb</li><li>Dandy brush</li><li>Hoof pick (use it every day)</li><li>Mane comb</li></ul>
<h3>Farrier and Vet</h3><p>The farrier comes every 6 weeks to trim or reshoe. Spring vaccinations and a deworming schedule keep the herd healthy.</p>
<h3>Turnout</h3><p>Horses need turnout time with friends. Blanket in winter only if they are clipped.</p>
<p>Riding notes: <a href="hoofbeats-dressage.html">Hoofbeats Dressage Page</a>.</p></font></td></tr></table>` }) }
];
