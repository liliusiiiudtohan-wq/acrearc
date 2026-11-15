"""Optional sample document; pip install reportlab. Uses sample-plan.json from TS engine."""
import json,pathlib,textwrap,calendar
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import reportlab
font_dir=pathlib.Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('Body',str(font_dir/'Vera.ttf')))
pdfmetrics.registerFont(TTFont('Body-Bold',str(font_dir/'VeraBd.ttf')))
from reportlab.lib.colors import HexColor,white
from reportlab.lib.pagesizes import A4,landscape
root=pathlib.Path(__file__).resolve().parents[1];p=json.loads((root/'docs/preview/sample-plan.json').read_text());score=p['score'];W,H=landscape(A4);out=root/'docs/preview/Example_Griffith_Farm_Brief.pdf';c=canvas.Canvas(str(out),pagesize=(W,H));c.setTitle('Field Shift - Example Griffith 36-month farm brief');c.setAuthor('Field Shift prototype');green=HexColor('#294d3a');muted=HexColor('#74816a');gold=HexColor('#ac804b')
names={'wheat':'Winter Wheat','barley':'Early Barley','canola':'Canola','chickpea':'Chickpea','lupin':'Narrow-Leaf Lupin','pea':'Field Pea','forage':'Forage Sorghum','grain':'Grain Sorghum','vetch':'Vetch Green Manure','cover':'Oats-Vetch Cover','fallow':'Fallow'}
def text(x,y,s,size=10,color=green,font='Body'):
 c.setFont(font,size);c.setFillColor(color);c.drawString(x,y,s)
def paragraph(s,x,y,width=110,size=10,leading=15,color=muted):
 for line in textwrap.wrap(s,width):text(x,y,line,size,color);y-=leading
 return y-8
def frame(page,title,sub):
 c.setFillColor(HexColor('#f7f8ef'));c.rect(0,0,W,H,fill=1,stroke=0)
 text(35,H-35,'field shift',22,green,'Body-Bold');text(W-260,H-31,'NASA SPACE APPS / PROTOTYPE v0.1',8,muted)
 c.setStrokeColor(HexColor('#d8e0cc'));c.line(35,H-51,W-35,H-51)
 text(35,H-82,title,25);text(35,H-105,sub,10,muted)
 c.setFillColor(HexColor('#efe2c2'));c.roundRect(35,H-143,W-70,24,4,fill=1,stroke=0);text(46,H-134,'EXAMPLE MODE - SYNTHETIC EVIDENCE - planning assumptions require local review',9,gold,'Body-Bold')
 text(35,24,'Griffith / Southern Basin | 2016-2025 reference | rules/1.0.0 | not an observed forecast or prescription',8,muted);text(W-65,24,f'{page} / 4',8,muted)
for i,year in enumerate([2027,2028,2029]):
 frame(i+1,f'Griffith / {year} planning calendar',f'Opportunity forage: Winter Wheat > Forage Sorghum > Chickpea | YEAR {i+1}')
 y=H-175;y=paragraph('Location: -34.28, 146.04; Griffith LGA is selection context. The sample footprint is separate from the LGA boundary.',35,y,128,9)
 y=paragraph('Scenario: +0.0 C air warming; 0% all-season rainfall; +0% heavy-rain intensity. Heavy day: historical rainfall >=20 mm/day. Runoff sensitivity: 0%, kept separate.',35,y,128,9)
 y=paragraph('Priorities: water 5 / soil 0 / erosion 5 / crop-market 5. Soil score is unavailable for forage pH bounds; zero soil weight allows a common-evidence comparison.',35,y,128,9)
 top=y-10;col=(W-70)/12
 for m in range(1,13):
  a=next(a for a in score['calendar'] if a['year']==year and a['month']==m);x=35+(m-1)*col
  bg='#eef3e1' if a['phase'] in ['Plant','Grow','Cover'] else '#f7efd9' if a['phase']=='Harvest' else '#eeeddf'
  c.setFillColor(HexColor(bg));c.roundRect(x+1,top-115,col-3,115,3,fill=1,stroke=0)
  text(x+7,top-18,calendar.month_abbr[m],10,green,'Body-Bold');text(x+7,top-38,a['phase'],8)
  yy=top-55
  for line in textwrap.wrap(names[a['crop']],11):text(x+7,yy,line,7,muted);yy-=11
  if a.get('flag'):text(x+7,top-104,'REVIEW',6,gold,'Body-Bold')
 y=top-140
 if year==2028:y=paragraph('October decision: example root-zone moisture 0.30 m3/m3 >0.22 threshold. Sorghum is eligible in this illustrative gate. Confirm stored water and reserve for the following winter pulse. This is not an irrigation model.',35,y,122,10)
 else:y=paragraph('Indicative operations only. Planting, flowering and harvest depend on variety, establishment rainfall, local soil water and management. Temperature-sensitive stages are flagged for review.',35,y,122,10)
 y=paragraph('Cross-year crop: forage sorghum planted October 2028 remains active through January-February 2029, with harvest in March 2029. The next winter pulse starts May 2029.',35,y,122,10)
 c.showPage()
frame(4,'Evidence, gaps and local review','A discussion brief for the grower and local agronomist')
y=H-178
for title,body in [('01 / EVIDENCE','This sample uses deterministic synthetic daily weather, IMERG-style rain, SMAP-style moisture, OPERA-style masks and schematic HLS-style imagery. Soil pH 6.2 (CaCl2) and root-zone moisture 0.30 m3/m3 are example inputs. No synthetic input is presented as a satellite observation. Fixture observation calendar: 2016-2025; grid 2025-10-15; imagery 2025-09-14 and 2025-11-08. See public/data/manifest.json and scripts/generate_examples.py.'),('02 / INFORMATION GAPS & UNCERTAINTY','Real POWER 2016-2025 weather is bundled separately for Dalby, Goondiwindi, Toowoomba, Warwick and Griffith. Real IMERG, SMAP, OPERA, HLS, MODIS, SLGA and ET remain unacquired. No local station, event or agronomic calibration is claimed. Forage soil-pH bounds and several non-core crop profile inputs remain unknown. No yield, profit or crop-loss probabilities are estimated.'),('03 / FARMER & AGRONOMIST REVIEW','Confirm seasonal water allocation and restrictions. Measure stored soil moisture; protect the following crop reserve. Check soil pH method, depth, drainage and waterlogging. Review herbicide plant-back, disease, variety, sowing windows, cover termination and retained residue. Confirm equipment, seed and local grain/forage markets.')]:
 text(35,y,title,10,green,'Body-Bold');y-=21;y=paragraph(body,35,y,130,10,15);y-=7
paragraph('Sample created from the same TypeScript rotation engine as the app. This PDF is a separately rendered sample; the browser print dialog and its pagination have not been visually verified in this build environment.',35,y,130,9,14,gold)
c.save();print(out)
