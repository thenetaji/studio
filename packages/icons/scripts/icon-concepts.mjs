// Curated icon concepts. Row: id | label | theme | phosphor base name | SF symbols (first is used by the "sf" style; the rest are aliases) | search keywords for other sets.
// Themes starting with "_" are UI glyphs (not shown in the category picker).
const T = `
food|Food|Food & drink|fork-knife|fork.knife|restaurant,utensils,dish,spoon-and-fork,chef-hat
fastfood|Fast food|Food & drink|hamburger|fork.knife|burger,hamburger,fast-food
takeaway|Takeaway|Food & drink|bowl-food|takeoutbag.and.cup.and.straw.fill|takeout,bowl,noodles,soup,cup-hot
pizza|Pizza|Food & drink|pizza|fork.knife|pizza
coffee|Coffee|Food & drink|coffee|cup.and.saucer.fill|coffee,cup-hot,tea-cup
tea|Tea|Food & drink|coffee-bean|mug.fill|coffee-beans,tea,cup-hot,mug
wine|Wine|Food & drink|wine|wineglass.fill|wine,glass-wine,wine-glass
beer|Beer|Food & drink|beer-stein|mug.fill|beer,beer-mug,pint
cocktail|Cocktail|Food & drink|martini|wineglass|cocktail,martini,glass-water
dessert|Dessert|Food & drink|cake|birthday.cake.fill|cake,cake-slice,birthday-cake,donut-bitten
icecream|Ice cream|Food & drink|ice-cream|snowflake|ice-cream,ice-cream-cone,cone
bakery|Bakery|Food & drink|bread|oven.fill|bread,croissant,baguette,wheat
fruit|Fruit|Food & drink|orange-slice|apple.logo|apple,cherry,orange,citrus
vegetables|Vegetables|Food & drink|carrot|carrot.fill|carrot,vegetable,salad,leafy-green
seafood|Seafood|Food & drink|fish|fish.fill|fish,shrimp,fish-simple
groceries|Groceries|Groceries & home|shopping-cart-simple|cart.fill|shopping-cart-01,cart-large-2,shopping-cart,cart
basket|Basket|Groceries & home|basket|basket.fill|shopping-basket-01,basket,shopping-basket
delivery|Delivery|Groceries & home|package|shippingbox.fill|package,box,delivery-box,parcel
scooter|Scooter|Transport|moped|scooter|moped,scooter,motorbike
car|Car|Transport|car-profile|car.fill|car-01,car,wheel
taxi|Taxi|Transport|taxi|car.side.fill|taxi,car-02,car
bus|Bus|Transport|bus|bus.fill,directions-bus|bus-01,bus
train|Train|Transport|train|train.side.front.car|train,train-front,tram
metro|Metro|Transport|subway|tram.fill|subway,tram,train-front-tunnel
bicycle|Bicycle|Transport|bicycle|bicycle|bicycle,bike,bike-01
fuel|Fuel|Transport|gas-pump|fuelpump.fill|fuel,gas-pump,fuel-station,gas-station
parking|Parking|Transport|letter-circle-p|parkingsign|parking,square-parking,parking-circle
ev-charging|EV charging|Transport|charging-station|bolt.car.fill|ev-charging,charging-station,plug-zap,battery-charging
tolls|Tolls|Transport|traffic-signal|road.lanes|traffic-light,road,route,signpost
ferry|Ferry|Transport|boat|ferry.fill|ferry,ship,boat,sailboat
flight|Flight|Travel|airplane-tilt|airplane|airplane-01,plane,airplane,plain-2
car-repair|Car repair|Transport|engine|wrench.and.screwdriver.fill|car-repair,engine,wrench
housing|Housing|Home|house-line|house.fill|home-01,house,home-2,home
rent|Rent|Home|key|key.fill|key-01,key
mortgage|Mortgage|Home|house-simple|house.and.flag.fill|home-04,house,cottage,home-smile
furniture|Furniture|Home|armchair|sofa.fill|sofa-01,armchair,sofa,sofa-2
bed|Bed|Home|bed|bed.double.fill|bed-single-01,bed,bed-double,bed-2
electricity|Electricity|Utilities|lightning|bolt.fill|flash,zap,bolt,electric
lightbulb|Lightbulb|Utilities|lightbulb|lightbulb.fill|idea,bulb,lightbulb,lamp
water|Water|Utilities|drop|drop.fill|drop,droplet,water,waterdrop
heating|Heating|Utilities|flame|flame.fill|fire,flame,fire-01
internet|Internet|Utilities|wifi-high|wifi|wifi-01,wifi,wi-fi-router,router
phone|Phone|Utilities|device-mobile|iphone|smart-phone-01,smartphone,phone-mobile,device-mobile
call|Call|Utilities|phone|phone.fill|call,phone,telephone
mail|Mail|Utilities|envelope-simple|envelope.fill|mail-01,mail,letter,envelope
tv|Television|Entertainment|television|tv.fill|tv-01,tv,television,monitor
cleaning|Cleaning|Home|broom|bubbles.and.sparkles.fill|cleaning,spray,broom,spray-can,washing-machine
laundry|Laundry|Home|washing-machine|washer.fill|washing-machine,laundry,shirt-folded,t-shirt
garden|Garden|Home|plant|tree.fill|plant,flower,tree-deciduous,sprout,tree
repairs|Repairs|Home|wrench|wrench.and.screwdriver.fill|wrench,tools,settings,repair
tools|Tools|Home|hammer|hammer.fill|hammer,hammer-01,tools
paint|Paint|Home|paint-roller|paintbrush.pointed.fill|paint-roller,paint-bucket,roller-brush
appliances|Appliances|Home|cooking-pot|refrigerator.fill|cooking-pot,microwave,fridge,chef-hat
solar-energy|Solar energy|Utilities|sun|sun.max.fill|sun,sun-01,solar-panel,sun-2
bill|Bill|Finance|receipt|doc.plaintext.fill|invoice,receipt,bill-list,bill
security|Security|Home|shield-check|shield.fill|shield,shield-check,shield-01
moving|Moving|Home|truck|truck.box.fill|truck,delivery-truck,truck-delivery
health|Health|Health|heartbeat|cross.case.fill|medicine-02,first-aid-kit,heart-pulse,health,medical-kit
hospital|Hospital|Health|first-aid|cross.fill,cross.circle.fill|hospital,hospital-01,cross,plus
pills|Pills|Health|pill|pills.fill|pills,medicine,pill,capsule,tablets
doctor|Doctor|Health|stethoscope|stethoscope|stethoscope,stethoscope-02,doctor
dentist|Dentist|Health|tooth|mouth.fill|tooth,dental,dental-care
eyecare|Eye care|Health|eyeglasses|eyeglasses|eye,glasses,sunglasses,eyeglasses
fitness|Fitness|Health|barbell|dumbbell.fill|dumbbell-01,dumbbell,gym,fitness
running|Running|Health|person-simple-run|figure.run|running,run,person-running,footprints,athlete
yoga|Yoga|Health|flower-lotus|figure.yoga|yoga,yoga-01,lotus,flower
swimming|Swimming|Health|swimming-pool|figure.pool.swim|swimming,waves,swimming-pool,waves-ladder
soccer|Soccer|Health|soccer-ball|soccerball|soccer,football,football-01,volleyball
basketball|Basketball|Health|basketball|basketball.fill|basketball,basketball-01
tennis|Tennis|Health|tennis-ball|tennis.racket|tennis,tennis-ball,racquet
golf|Golf|Health|golf|figure.golf|golf,golf-01,flag
boxing|Boxing|Health|boxing-glove|figure.boxing|boxing-glove,boxing,sword
heart|Heart|Health|heart|heart.fill|heart,favourite,heart-01
mindfulness|Mindfulness|Health|brain|brain.head.profile|brain,brain-02,head,brain-01
wellness|Wellness|Health|flower|leaf.fill,eco|spa,spa-01,leaf,flower,leaf-01
pets|Pets|Family & pets|paw-print|pawprint.fill|paw-print,paw,pet,dog
dog|Dog|Family & pets|dog|dog.fill|dog,dog-01,paw-print
cat|Cat|Family & pets|cat|cat.fill|cat,cat-01,paw-print
kids|Kids|Family & pets|baby|stroller.fill|baby,baby-01,baby-bottle,child
toys|Toys|Family & pets|puzzle-piece|teddybear.fill|puzzle,toy,teddy-bear,blocks,puzzle-piece
childcare|Childcare|Family & pets|baby-carriage|figure.and.child.holdinghands|baby-carriage,stroller,baby,hand-heart
family|Family|Family & pets|users-three|person.2.fill|users,user-group,users-round,people,family
person|Person|Family & pets|user|person.fill|user,user-01,user-circle,user-round
education|Education|Education|graduation-cap|graduationcap.fill|mortarboard-01,graduation-cap,square-academic-cap,mortarboard
book|Book|Education|book-open|book.fill|book-open-01,book-open,book,book-2
library|Books|Education|books|books.vertical.fill|books,library,book-bookmark,book-02
backpack|School|Education|backpack|backpack.fill|backpack,school,school-bag,bag
courses|Courses|Education|chalkboard-teacher|studentdesk|chalkboard,teacher,presentation,online-learning
stationery|Stationery|Education|pencil-simple-line|pencil.and.ruler.fill|pencil-ruler,pencil,ruler,pen,pen-2
language|Language|Education|translate|character.bubble.fill|translate,languages,language,chat
travel|Travel|Travel|suitcase-rolling|suitcase.fill|luggage-01,luggage,suitcase,briefcase-02,bag
hotel|Hotel|Travel|building-apartment|building.2.fill,apartment|hotel-01,hotel,building-2,buildings-2,buildings
beach|Beach|Travel|umbrella-simple|umbrella.fill,beach.umbrella.fill|beach,umbrella,sun,umbrella-01
camping|Camping|Travel|tent|tent.fill|tent,campfire,camping,mountain
mountains|Mountains|Travel|mountains|mountain.2.fill|mountain,mountains,mountain-01,mountain-snow
passport|Passport|Travel|identification-card|person.text.rectangle.fill|passport,id-card,identification,card-2
map|Map|Travel|map-trifold|map.fill|map,map-01,map-pin,map-point
globe|Globe|Travel|globe|globe|globe,globe-01,earth,planet
photo|Photo|Travel|camera|camera.fill|camera-01,camera,camera-2
shopping|Shopping|Shopping|shopping-bag|bag.fill|shopping-bag-01,shopping-bag,bag-4,bag-3
clothes|Clothes|Shopping|t-shirt|tshirt.fill|shirt-01,shirt,t-shirt,hanger
shoes|Shoes|Shopping|sneaker|shoeprints.fill|footprints,sneaker,shoe,shoes
jewelry|Jewelry|Shopping|diamond|diamond.fill|diamond,gem,diamond-01,crown
watch|Watch|Shopping|watch|applewatch|watch-01,watch,smart-watch-01,watch-2
freelance|Freelance|Income|laptop|laptopcomputer|laptop,laptop-01,laptop-minimalistic,laptop-3
electronics|Electronics|Shopping|devices|desktopcomputer|computer,devices,monitor,monitor-smartphone,pc
headphones|Headphones|Shopping|headphones|headphones|headphones,headset,headphones-01,headphones-round
gift|Gift|Shopping|gift|gift.fill,giftcard.fill|gift,gift-01
tag|Tag|Shopping|tag|tag.fill|tag,tag-01,tag-2
sale|Sale|Shopping|seal-percent|percent|discount,percent,badge-percent,sale
store|Store|Shopping|storefront|storefront.fill|store-01,store,shop,store-2,storefront
beauty|Beauty|Shopping|hair-dryer|face.smiling.fill|makeup,sparkles,lipstick,palette
haircut|Haircut|Shopping|scissors|scissors|scissors,scissor,scissors-01
entertainment|Entertainment|Entertainment|popcorn|play.rectangle.fill|popcorn,film-01,clapperboard-play,clapperboard,tv
movies|Movies|Entertainment|film-slate|film.fill|film-01,film,clapperboard,video
music|Music|Entertainment|music-notes|music.note|music-note-01,music,music-notes,music-note
concert|Concert|Entertainment|microphone-stage|music.mic|mic-01,mic,microphone,mic-vocal,microphone-2
games|Games|Entertainment|game-controller|gamecontroller.fill|game-controller,gamepad,gamepad-2,gamepad-01
theatre|Theatre|Entertainment|mask-happy|theatermasks.fill|drama,mask,theater,masks
tickets|Tickets|Entertainment|ticket|ticket.fill|ticket-01,ticket,tickets,ticket-star
hobbies|Hobbies|Entertainment|palette|paintpalette.fill|paint-board,palette,paintbrush,brush
party|Party|Entertainment|confetti|party.popper.fill|party-popper,confetti,party,celebration
podcast|Podcast|Entertainment|microphone|mic.fill|podcast,mic,microphone,radio
subscriptions|Subscriptions|Subscriptions|arrows-clockwise|arrow.triangle.2.circlepath|repeat,refresh,refresh-circle,restart,rotate-cw
cloud|Cloud|Subscriptions|cloud|cloud.fill|cloud-upload,cloud,cloud-01,cloud-storage
software|Software|Subscriptions|app-window|app.fill|app-window,apps,window-frame,code,code-square
ai|AI|Subscriptions|robot|cpu.fill|bot,robot,cpu,bot-01,chip
vpn|VPN|Subscriptions|shield-check|lock.shield.fill|shield-check,shield-lock,vpn,shield-keyhole,security
hosting|Hosting|Subscriptions|hard-drives|server.rack|server,server-01,database,hard-drive
news|News|Subscriptions|newspaper|newspaper.fill|news,newspaper,news-01,notebook
membership|Membership|Subscriptions|medal|rosette|medal,award,award-01,crown,star
salary|Salary|Income|money-wavy|banknote.fill|money-bag,banknote,wallet-money,money,coins
cash|Cash|Finance|money|banknote|cash,banknote-01,money,money-bag,dollar
investments|Investments|Income|chart-line-up|chart.line.uptrend.xyaxis|chart-increasing,trending-up,chart-line,chart-up,graph-up
stocks|Stocks|Income|trend-up|chart.xyaxis.line|candlestick-chart,chart-candlestick,chart-2,stock,trending-up
crypto|Crypto|Income|currency-btc|bitcoinsign.circle.fill|bitcoin-circle,bitcoin,bitcoin-01,currency-bitcoin
savings|Savings|Finance|piggy-bank|tray.full.fill|saving,piggy-bank,safe,safe-2,wallet-money
taxes|Taxes|Finance|calculator|doc.text.magnifyingglass|calculator,calculator-01,calculator-minimalistic,file-text
insurance|Insurance|Finance|shield-check|checkmark.shield.fill|shield-check,shield-user,shield-01,security-check,shield
charity|Charity|Finance|hand-heart|heart.circle.fill|hand-heart,donation,charity,heart-handshake,hand-holding-heart
loans|Loans|Finance|hand-coins|creditcard.and.123|hand-coins,money-send,handshake,coins-hand,hand-coin
dividends|Dividends|Income|coins|dollarsign.square.fill|coins,coin,coins-01,money-bag
dollar|Dollar|Finance|currency-dollar|dollarsign.circle.fill|dollar-circle,dollar,circle-dollar-sign,dollar-sign
euro|Euro|Finance|currency-eur|eurosign.circle.fill|euro-circle,euro,circle-euro-sign,euro-sign
rupee|Rupee|Finance|currency-inr|indianrupeesign.circle.fill|rupee,indian-rupee,rupee-sign,rupee-circle
pound|Pound|Finance|currency-gbp|sterlingsign.circle.fill|pound,pound-sterling,pound-circle,sterling
bank|Bank|Finance|bank|building.columns.fill|bank,building-bank,bank-01,landmark
card|Card|Finance|credit-card|creditcard.fill,creditcard|credit-card,credit-card-01,card,card-2
wallet|Wallet|Finance|wallet|wallet.pass.fill|wallet-01,wallet,wallet-2,wallet-money
refund|Refund|Income|arrow-counter-clockwise|arrow.uturn.backward.circle.fill|refund,undo,rotate-ccw,undo-circle,restart
bonus|Bonus|Income|trophy|trophy.fill|trophy,trophy-01,award,medal
business|Business|Work|briefcase|briefcase.fill|briefcase-01,briefcase,case,case-round
office|Office|Work|office-chair|chair.lounge.fill|office-chair,chair,desk,building,armchair
printing|Printing|Work|printer|printer.fill|printer,printer-01,printer-2,printer-minimalistic
retirement|Retirement|Finance|hourglass|hourglass|hourglass,hourglass-01,hourglass-line,timer
tips|Tips|Finance|coin|centsign.circle.fill|coin,coins,coin-01,hand-coins
legal|Legal|Work|scales|scalemass.fill|scale,scales,law,gavel,justice
religion|Religion|Family & pets|church|building.columns|church,hands-praying,pray,star
smoking|Smoking|Personal|cigarette|smoke.fill|cigarette,smoking,cigarette-01,flame
personal|Personal|Personal|sparkle|sparkles|sparkles,stars,star-shine,sparkle,magic-stick
star|Star|Personal|star|star.fill|star,star-01,star-circle,stars
leaf|Nature|Personal|leaf|leaf.fill,eco|leaf,leaf-01,sprout,plant
flower|Flower|Personal|flower-tulip|camera.macro|flower,flower-01,flower-2,rose
moon|Moon|Personal|moon|moon.fill,moon.stars|moon,moon-01,moon-stars
rain|Rain|Personal|cloud-rain|cloud.rain.fill|cloud-rain,cloud-drizzle,cloud-rain-01,cloud-showers-heavy
other|Other|Personal|dots-three-circle|ellipsis.circle.fill|more-horizontal-circle,circle-ellipsis,menu-dots-circle,more-circle
home|Home|_UI|house-simple|house|home-01,house,home-2,home
activity|Activity|_UI|receipt|list.bullet.rectangle.fill|receipt,invoice-01,bill-list,receipt-text
insights|Insights|_UI|chart-bar|chart.bar.fill,chart.pie.fill|chart-column-increasing,chart-bar,bar-chart
budgets|Budgets|_UI|gauge|gauge.with.dots.needle.33percent|dashboard-speed-01,gauge,speedometer-middle,speedometer
settings|Settings|_UI|gear-six|gearshape,gearshape.fill|settings-01,settings,settings-2
eye|Eye|_UI|eye|eye|eye,eye-open,view
eye-off|Eye off|_UI|eye-slash|eye.slash|eye-off,eye-closed,view-off,eye-slash
search|Search|_UI|magnifying-glass|magnifyingglass|search-01,search,magnifer
filter|Filter|_UI|funnel-simple|line.3.horizontal.decrease.circle|filter-horizontal,list-filter,filter,filter-01
filter-active|Filter active|_UI|funnel|line.3.horizontal.decrease.circle.fill|filter-horizontal,list-filter,filter,filter-01
add|Add|_UI|plus|plus|add-01,plus,add-circle,plus-sign
add-circle|Add circle|_UI|plus-circle|plus.circle.fill,plus.circle|add-circle,plus-circle,circle-plus,plus-sign-circle
minus|Minus|_UI|minus|minus|remove-01,minus,minus-circle,minus-sign
minus-circle|Minus circle|_UI|minus-circle|minus.circle,minus.circle.fill|minus-circle,circle-minus,minus-sign-circle,remove-circle
pencil|Edit|_UI|pencil-simple|pencil|edit-02,pencil,pen,pen-2
trash|Delete|_UI|trash|trash,trash.fill|delete-02,trash-2,trash,trash-bin-minimalistic,trash-bin-trash
repeat|Repeat|_UI|repeat|repeat|repeat,refresh,restart,rotate-cw
grid|Grid|_UI|squares-four|square.grid.2x2|grid-view,layout-grid,widget,widget-2,grid
split|Split|_UI|columns|square.split.2x1|layout-two-column,columns,columns-2,sidebar,layout-panel-left
circle|Circle|_UI|circle|circle|circle,radio-button,record-circle,circle-01
check|Check|_UI|check|checkmark|tick-02,check,check-read,check-circle
check-circle|Check circle|_UI|check-circle|checkmark.circle.fill|checkmark-circle-02,circle-check,check-circle,check-circle-big
close|Close|_UI|x|xmark|cancel-01,x,close-circle,close
close-circle|Close circle|_UI|x-circle|xmark.circle.fill|cancel-circle,circle-x,close-circle,x-circle
backspace|Backspace|_UI|backspace|delete.left,delete.left.fill|backspace,delete,delete-left,arrow-left
copy|Copy|_UI|copy|doc.on.doc|copy-01,copy,copy-2,copy-minimalistic
share|Share|_UI|export|square.and.arrow.up|share-08,share,share-2,upload,upload-minimalistic
download|Download|_UI|download-simple|square.and.arrow.down|download-01,download,download-minimalistic,download-square
lock|Lock|_UI|lock|lock.fill|lock,square-lock-01,lock-keyhole,lock-password
faceid|Face ID|_UI|user-focus|faceid|face-id,scan-face,scan-smiley,user-focus,smile-circle
bell|Bell|_UI|bell|bell.fill|notification-03,bell,notification-01,bell-ring
calendar|Calendar|_UI|calendar-blank|calendar|calendar-03,calendar,calendar-minimalistic,calendar-01
clock|Clock|_UI|clock|clock|clock-01,clock,clock-circle,alarm-clock
paintbrush|Appearance|_UI|paint-brush|paintbrush.fill|paint-brush-02,paintbrush,paint-brush,palette,brush
info|Info|_UI|info|info.circle|information-circle,info,info-circle
swap|Transfer|_UI|arrows-left-right|arrow.left.arrow.right|arrow-left-right,arrows-left-right,transfer-horizontal,arrow-left-right
arrow-right|Arrow right|_UI|arrow-right|arrow.right|arrow-right-01,arrow-right,arrow-right-linear
forward|Forward|_UI|skip-forward|forward.fill|next,skip-forward,forward,skip-next
arrow-up|Arrow up|_UI|arrow-up|arrow.up|arrow-up-01,arrow-up,arrow-up-linear
arrow-down|Arrow down|_UI|arrow-down|arrow.down|arrow-down-01,arrow-down,arrow-down-linear
arrow-up-right|Arrow up right|_UI|arrow-up-right|arrow.up.right|arrow-up-right,arrow-up-right-01,arrow-up-right-02,arrow-up-right-linear
arrow-down-right|Arrow down right|_UI|arrow-down-right|arrow.down.right|arrow-down-right,arrow-down-right-01,arrow-down-right-02,arrow-down-right-linear
chevron-down|Chevron down|_UI|caret-down|chevron.down|arrow-down-01,chevron-down,alt-arrow-down
chevron-up|Chevron up|_UI|caret-up|chevron.up|arrow-up-01,chevron-up,alt-arrow-up
chevron-left|Chevron left|_UI|caret-left|chevron.left|arrow-left-01,chevron-left,alt-arrow-left
chevron-right|Chevron right|_UI|caret-right|chevron.right|arrow-right-01,chevron-right,alt-arrow-right
drag|Drag|_UI|dots-six|line.3.horizontal|drag-drop-vertical,grip-horizontal,menu-01,hamburger-menu,menu
more|More|_UI|dots-three|ellipsis|more-horizontal,ellipsis,menu-dots,more-horizontal-circle
question|Help|_UI|question|questionmark.circle.fill|help-circle,circle-help,question-circle,question
inbox|Inbox|_UI|tray|tray,tray.fill|inbox,inbox-line,inbox-in,archive,mailbox
document|Document|_UI|file-text|doc.text.fill|file-01,file-text,document-text,document
`;

export const concepts = T.trim()
  .split("\n")
  .map((line) => {
    const [id, label, theme, ph, sf, kw] = line.split("|");
    return { id, label, theme, ph, sf: sf.split(","), kw: kw.split(",") };
  });
