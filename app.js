/* MoYin Reader · 墨吟 —— 单文件 TXT/EPUB 阅读 + 朗读 */
(function () {
  'use strict';
  var Z = window.MYZip, $ = function (id) { return document.getElementById(id); };
  var I18N = window.MYI18N || null;
  /* 所有界面文案过一遍 T()：中文原样返回，英文查 i18n.js 的词典 */
  function T(s, a) { return I18N ? I18N.t(s, a) : s; }
  var DBNAME = 'MoYinReader', CFGKEY = 'MOYIN_CFG', GEN = 1;
  var VER = '1.14.40';
  var HL_COLORS = ['y', 'g', 'b', 'p'];
  var FONTS = {
    serif: '"Noto Serif CJK SC","Songti SC","SimSun",Georgia,serif',
    sans: '"SimHei","Heiti SC","STHeiti",sans-serif',
    yahei: '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",system-ui,sans-serif',
    kai: '"Kaiti SC","KaiTi","STKaiti",serif',
    fang: '"FangSong","STFangsong","FangSong_GB2312",serif',
    song2: '"STZhongsong","SimSun","Songti SC",serif',
    li: '"LiSu","STLiti","Baoli SC",serif',
    yuan: '"YouYuan","Yuanti SC","Arial Rounded MT Bold",sans-serif',
    deng: '"DengXian","Microsoft YaHei",sans-serif',
    mono: '"Cascadia Mono","Consolas","Courier New",monospace'
  };
  /* 字体清单：顺序即界面顺序。'sans' 保留给老配置（那时叫黑体） */
  var FONT_LIST = [
    ['serif', '宋体'], ['yahei', '雅黑'], ['sans', '黑体'], ['kai', '楷体'], ['fang', '仿宋'],
    ['song2', '中宋'], ['li', '隶书'], ['yuan', '幼圆'], ['deng', '等线'], ['mono', '等宽']
  ];
  /* 常用字色 / 底色：点一下就用，不想选也能一眼看出区别 */
  var TX_SW = [
    ['#1A1A1A', '墨黑'], ['#33322F', '烟灰'], ['#4A3728', '深棕'], ['#5B3A29', '赭石'],
    ['#2B4162', '藏青'], ['#364A38', '墨绿'], ['#6B2F2F', '暗红'], ['#4B3B5A', '紫棠']
  ];
  var BG_SW = [
    ['#FBFAF7', '纸白'], ['#F6EFDF', '米黄'], ['#EFE4CB', '羊皮'], ['#EDF2E8', '豆绿'],
    ['#E8EEF4', '浅蓝'], ['#F3EDEA', '藕粉'], ['#E9E6DF', '暖灰'], ['#2A2D33', '深灰']
  ];
  /* 繁体 → 简体 单字映射（取自 OpenCC 的 TSCharacters，只保留一对一、去掉同字项，共 2965 对）。
     刻意用**等长替换**：每个字换成一个字，正文长度不变，所以划线、笔记、朗读分段的
     字符偏移全都不会错位。关闭开关时直接重新渲染本章即可还原原文。 */
  var TS_FROM = '㑯㑳㑶㓨㘚㜄㜏㠏㥮㩜㩳㩵䁻䃮䊷䋙䋚䋹䋻䍦䎱䙡䜀䝼䥇䥑䥱䦛䦟䯀䰾䱷䱽䲁䲘䴉丟並乾亂亙亞佇佈佔併來侖侶侷俁係俔俠俥俬倀倆倈倉個們倖倫倲偉偑側偵偽傌傑傖傘備傢傭傯傳傴債傷傾僂僅僉僑僕僞僥僨僱價儀儁儂億儈儉儎儐儔儕儘償優儲儷儸儺儻儼兇兌兒兗內兩冊冑冪凈凍凜凱別刪剄則剋剎剗剛剝剮剴創剷劃劄劇劉劊劌劍劏劑劚勁動務勛勝勞勢勩勱勳勵勸勻匭匯匱區協卹卻卽厙厠厤厭厲厴參叄叢吒吳吶呂咼員唄唸問啓啞啟啢喎喚喪喫喬單喲嗆嗇嗊嗎嗚嗩嗶嘆嘍嘓嘔嘖嘗嘜嘩嘮嘯嘰嘵嘸嘽噁噓噚噝噠噥噦噯噲噴噸噹嚀嚇嚌嚐嚕嚙嚥嚦嚨嚮嚲嚳嚴嚶囀囁囂囅囈囉囌囑囪圇國圍園圓圖團垻埡埰執堅堊堖堝堯報場塊塋塏塒塗塚塢塤塵塹墊墜墮墰墳墶墻墾壇壋壎壓壘壙壚壜壞壟壠壢壩壪壯壺壼壽夠夢夥夾奐奧奩奪奬奮奼妝姍姦娛婁婦婭媧媯媰媼媽嫋嫗嫵嫺嫻嫿嬀嬃嬈嬋嬌嬙嬡嬤嬪嬰嬸孃孋孌孫學孿宮寀寢實寧審寫寬寵寶將專尋對導尷屆屍屓屜屢層屨屬岡峯峴島峽崍崑崗崙崢崬嵐嵗嵾嶁嶄嶇嶔嶗嶠嶢嶧嶨嶮嶸嶺嶼嶽巋巒巔巖巰巹帥師帳帶幀幃幓幗幘幟幣幫幬幷幹幾庫廁廂廄廈廎廕廚廝廟廠廡廢廣廩廬廳弒弔弳張強彆彈彌彎彔彙彠彥彫彲彿後徑從徠復徵徹恆恥悅悞悵悶悽惡惱惲惻愛愜愨愴愷愾慄態慍慘慚慟慣慤慪慫慮慳慶慺慼慾憂憊憐憑憒憖憚憤憫憮憲憶懇應懌懍懞懟懣懤懨懲懶懷懸懺懼懾戀戇戔戧戩戰戱戲戶扞拋拚挩挱挾捨捫捱捲掃掄掆掗掙掛採揀揚換揮揯損搖搗搧搵搶摑摜摟摯摳摶摺摻撈撏撐撓撝撟撣撥撫撲撳撻撾撿擁擄擇擊擋擓擔據擠擡擣擬擯擰擱擲擴擷擺擻擼擽擾攄攆攏攔攖攙攛攜攝攢攣攤攪攬敎敓敗敘敵數斂斃斆斕斬斷於旂旣昇時晉晝暈暉暘暢暫曄曆曇曉曏曖曠曨曬書會朧朮東枴柵柺査桿梔梘條梟梲棄棊棖棗棟棡棧棲棶椏椲楊楓楨業極榘榦榪榮榲榿構槍槓槤槧槨槮槳槶槼樁樂樅樑樓標樞樢樣樧樫樳樸樹樺樿橈橋機橢橫檁檉檔檜檟檢檣檮檯檳檸檻櫃櫓櫚櫛櫝櫞櫟櫥櫧櫨櫪櫫櫬櫱櫳櫸櫻欄欅權欏欒欖欞欽歎歐歟歡歲歷歸歿殘殞殤殨殫殭殮殯殰殲殺殻殼毀毆毿氂氈氌氣氫氬氳氾汎汙決沒沖況泝洩洶浹涇涗涼淒淚淥淨淩淪淵淶淺渙減渢渦測渾湊湞湧湯溈準溝溫溮溳溼滄滅滌滎滙滬滯滲滷滸滻滾滿漁漊漚漢漣漬漲漵漸漿潁潑潔潙潚潛潤潯潰潷潿澀澆澇澐澗澠澤澦澩澮澱澾濁濃濄濕濘濚濛濜濟濤濧濫濰濱濺濼濾瀂瀅瀆瀇瀉瀋瀏瀕瀘瀝瀟瀠瀦瀧瀨瀰瀲瀾灃灄灑灕灘灝灡灣灤灧灩災為烏烴無煉煒煙煢煥煩煬煱熅熒熗熱熲熾燁燈燉燒燙燜營燦燬燭燴燶燻燼燾爍爐爛爭爲爺爾牀牆牘牴牽犖犛犢犧狀狹狽猙猶猻獁獃獄獅獎獨獪獫獮獰獱獲獵獷獸獺獻獼玀現琱琺琿瑋瑒瑣瑤瑩瑪瑲璉璡璣璦璫璯環璵璸璽璿瓊瓏瓔瓚甌甕產産畝畢畫異畵當疇疊痙痠痾瘂瘋瘍瘓瘞瘡瘧瘮瘲瘺瘻療癆癇癉癒癘癟癡癢癤癥癧癩癬癭癮癰癱癲發皁皚皰皸皺盃盜盞盡監盤盧盪眞眥眾睏睜睞瞘瞜瞞瞶瞼矇矓矚矯硃硜硤硨硯碕碩碭碸確碼碽磑磚磠磣磧磯磽磾礄礎礙礦礪礫礬礱祕祿禍禎禕禡禦禪禮禰禱禿秈稅稈稏稜稟種稱穀穇穌積穎穠穡穢穩穫穭窩窪窮窯窵窶窺竄竅竇竈竊竪競筆筍筧筴箇箋箏箚節範築篋篔篠篤篩篳簀簍簑簞簡簣簫簹簽簾籃籌籔籙籛籜籟籠籤籩籪籬籮籲粵糉糝糞糧糰糲糴糶糹糾紀紂約紅紆紇紈紉紋納紐紓純紕紖紗紘紙級紛紜紝紡紬紮細紱紲紳紵紹紺紼紿絀終絃組絅絆絎結絕絛絝絞絡絢給絨絰統絲絳絶絹綁綃綆綈綉綌綏綐綑經綜綞綠綢綣綫綬維綯綰綱網綳綴綵綸綹綺綻綽綾綿緄緇緊緋緑緒緓緔緗緘緙線緝緞締緡緣緦編緩緬緯緱緲練緶緹緻緼縈縉縊縋縐縑縕縗縛縝縞縟縣縧縫縭縮縱縲縳縴縵縶縷縹總績繃繅繆繒織繕繚繞繡繢繩繪繫繭繮繯繰繳繸繹繼繽繾繿纇纈纊續纍纏纓纔纖纘纜缽罃罈罌罎罰罵罷羅羆羈羋羣羥羨義羶習翫翬翹翽耬耮聖聞聯聰聲聳聵聶職聹聽聾肅脅脈脛脣脩脫脹腎腖腡腦腫腳腸膃膕膚膞膠膩膽膾膿臉臍臏臘臚臟臠臢臥臨臺與興舉舊舖舘艙艤艦艫艱艷芻苧茲荊莊莖莢莧華菴菸萇萊萬萴萵葉葒葤葦葯葷蒐蒓蒔蒕蒞蒼蓀蓆蓋蓮蓯蓴蓽蔔蔘蔞蔣蔥蔦蔭蕁蕆蕎蕒蕓蕕蕘蕢蕩蕪蕭蕷薀薈薊薌薑薔薘薟薦薩薴薵薹薺藍藎藝藥藪藭藴藶藹藺蘀蘄蘆蘇蘊蘋蘚蘞蘢蘭蘺蘿虆處虛虜號虧虯蛺蛻蜆蝕蝟蝦蝨蝸螄螞螢螮螻螿蟄蟈蟎蟣蟬蟯蟲蟶蟻蠁蠅蠆蠍蠐蠑蠔蠟蠣蠨蠱蠶蠻衆衊術衕衚衛衝袞袷裊裏補裝裡製複褌褘褲褳褸褻襇襉襏襖襝襠襤襪襬襯襲襴覈見覎規覓視覘覡覥覦親覬覯覲覷覺覽覿觀觴觶觸訁訂訃計訊訌討訐訒訓訕訖託記訛訝訟訢訣訥訩訪設許訴訶診註証詁詆詎詐詒詔評詖詗詘詛詞詠詡詢詣試詩詫詬詭詮詰話該詳詵詼詿誄誅誆誇誌認誑誒誕誘誚語誠誡誣誤誥誦誨說説誰課誶誹誼誾調諂諄談諉請諍諏諑諒論諗諛諜諝諞諡諢諤諦諧諫諭諮諱諳諶諷諸諺諼諾謀謁謂謄謅謊謎謐謔謖謗謙謚講謝謠謡謨謫謬謭謳謹謾譁證譎譏譖識譙譚譜譟譫譭譯議譴護譸譽譾讀讅變讋讌讎讒讓讕讖讚讜讞谿豈豎豐豔豬豶貍貓貙貝貞貟負財貢貧貨販貪貫責貯貰貲貳貴貶買貸貺費貼貽貿賀賁賂賃賄賅資賈賊賑賒賓賕賙賚賜賞賠賡賢賣賤賦賧質賫賬賭賰賴賵賺賻購賽賾贄贅贇贈贊贋贍贏贐贓贔贖贗贛贜赬趕趙趨趲跡踐踰踴蹌蹕蹟蹠蹣蹤蹺躂躉躊躋躍躎躑躒躓躕躚躡躥躦躪軀車軋軌軍軑軒軔軛軟軤軫軲軸軹軺軻軼軾較輅輇輈載輊輒輓輔輕輛輜輝輞輟輥輦輩輪輬輯輳輸輻輼輾輿轀轂轄轅轆轉轍轎轔轟轡轢轤辦辭辮辯農迴逕這連週進遊運過達違遙遜遞遠遡適遲遶遷選遺遼邁還邇邊邏邐郟郵鄆鄉鄒鄔鄖鄧鄭鄰鄲鄴鄶鄺酇酈醃醖醜醞醟醣醫醬醱釀釁釃釅釋釐釒釓釔釕釗釘釙針釣釤釦釧釩釵釷釹釺釾鈀鈁鈃鈄鈅鈈鈉鈍鈎鈐鈑鈒鈔鈕鈞鈡鈣鈥鈦鈧鈮鈰鈳鈴鈷鈸鈹鈺鈽鈾鈿鉀鉅鉆鉈鉉鉋鉍鉑鉕鉗鉚鉛鉞鉢鉤鉦鉬鉭鉳鉶鉸鉺鉻鉿銀銃銅銍銑銓銖銘銚銛銜銠銣銥銦銨銩銪銫銬銱銳銷銹銻銼鋁鋃鋅鋇鋌鋏鋒鋙鋝鋟鋣鋤鋥鋦鋨鋩鋪鋭鋮鋯鋰鋱鋶鋸鋼錁錄錆錇錈錏錐錒錕錘錙錚錛錟錠錡錢錦錨錩錫錮錯録錳錶錸錼鍀鍁鍃鍅鍆鍇鍈鍊鍋鍍鍔鍘鍚鍛鍠鍤鍥鍩鍬鍰鍵鍶鍺鍼鍾鎂鎄鎇鎊鎌鎔鎖鎘鎚鎛鎡鎢鎣鎦鎧鎩鎪鎬鎭鎮鎰鎲鎳鎵鎶鎸鎿鏃鏇鏈鏌鏍鏐鏑鏗鏘鏜鏝鏞鏟鏡鏢鏤鏨鏰鏵鏷鏹鏺鏽鐃鐋鐐鐒鐓鐔鐘鐙鐝鐠鐥鐦鐧鐨鐫鐮鐯鐲鐳鐵鐶鐸鐺鐿鑄鑊鑌鑑鑒鑔鑕鑞鑠鑣鑥鑭鑰鑱鑲鑷鑹鑼鑽鑾鑿钁钂長門閂閃閆閈閉開閌閎閏閑閒間閔閘閡閣閤閥閨閩閫閬閭閱閲閶閹閻閼閽閾閿闃闆闇闈闊闋闌闍闐闒闓闔闕闖關闞闠闡闢闤闥陘陝陞陣陰陳陸陽隉隊階隕際隨險隯隱隴隸隻雋雖雙雛雜雞離難雲電霑霢霧霽靂靄靆靈靉靚靜靝靦靨鞏鞝鞦鞽韁韃韆韉韋韌韍韓韙韜韝韞韻響頁頂頃項順頇須頊頌頎頏預頑頒頓頗領頜頡頤頦頭頮頰頲頴頷頸頹頻頽顆題額顎顏顒顓顔願顙顛類顢顥顧顫顬顯顰顱顳顴風颭颮颯颱颳颶颸颺颻颼飀飄飆飈飛飠飢飣飥飩飪飫飭飯飱飲飴飼飽飾飿餃餄餅餈餉養餌餎餏餑餒餓餕餖餘餚餛餜餞餡館餬餱餳餵餶餷餺餼餾餿饁饃饅饈饉饊饋饌饑饒饗饜饞饢馬馭馮馱馳馴馹駁駐駑駒駔駕駘駙駛駝駟駡駢駭駰駱駸駿騁騂騅騌騍騎騏騖騙騤騧騫騭騮騰騶騷騸騾驀驁驂驃驄驅驊驌驍驏驕驗驚驛驟驢驤驥驦驪驫骯髏髒體髕髖髮鬆鬍鬚鬢鬥鬧鬨鬩鬮鬱鬹魎魘魚魛魢魨魯魴魷魺鮁鮃鮊鮋鮍鮎鮐鮑鮒鮓鮚鮜鮝鮞鮣鮦鮪鮫鮭鮮鮳鮶鮺鯀鯁鯇鯉鯊鯒鯔鯕鯖鯗鯛鯝鯡鯢鯤鯧鯨鯪鯫鯰鯴鯷鯽鯿鰁鰂鰃鰆鰈鰉鰌鰍鰏鰐鰒鰓鰛鰜鰟鰠鰣鰥鰧鰨鰩鰭鰮鰱鰲鰳鰵鰷鰹鰺鰻鰼鰾鱂鱅鱈鱉鱒鱔鱖鱗鱘鱝鱟鱠鱣鱤鱧鱨鱭鱯鱷鱸鱺鳥鳧鳩鳬鳲鳳鳴鳶鳾鴆鴇鴉鴒鴕鴛鴝鴞鴟鴣鴦鴨鴯鴰鴴鴷鴻鴿鵁鵂鵃鵐鵑鵒鵓鵜鵝鵠鵡鵪鵬鵮鵯鵰鵲鵷鵾鶄鶇鶉鶊鶓鶖鶘鶚鶡鶥鶩鶪鶬鶯鶲鶴鶹鶺鶻鶼鶿鷀鷁鷂鷄鷉鷊鷓鷖鷗鷙鷚鷥鷦鷫鷯鷲鷳鷴鷸鷹鷺鷽鸂鸇鸊鸌鸏鸕鸘鸚鸛鸝鸞鹵鹹鹺鹼鹽麗麥麩麪麫麯麴麵麼麽黃黌點黨黲黴黶黷黽黿鼂鼉鼕鼴齊齋齎齏齒齔齕齗齙齜齟齠齡齣齦齧齪齬齲齶齷龍龎龐龑龔龕龜鿁鿓';
  var TS_TO = '㑔㑇㐹刾㘎㚯㛣㟆㤘㨫㧐擜䀥鿎䌶䌺䌻䌿䌾䍠䎬䙌䜧䞍䦂鿏䥾䦶䦷䯅鲃䲣䲝鳚鳤鹮丢并干乱亘亚伫布占并来仑侣局俣系伣侠伡私伥俩俫仓个们幸伦㑈伟㐽侧侦伪㐷杰伧伞备家佣偬传伛债伤倾偻仅佥侨仆伪侥偾雇价仪俊侬亿侩俭傤傧俦侪尽偿优储俪㑩傩傥俨凶兑儿兖内两册胄幂净冻凛凯别删刭则克刹刬刚剥剐剀创铲划札剧刘刽刿剑㓥剂㔉劲动务勋胜劳势勚劢勋励劝匀匦汇匮区协恤却即厍厕历厌厉厣参叁丛咤吴呐吕呙员呗念问启哑启唡㖞唤丧吃乔单哟呛啬唝吗呜唢哔叹喽啯呕啧尝唛哗唠啸叽哓呒啴恶嘘㖊咝哒哝哕嗳哙喷吨当咛吓哜尝噜啮咽呖咙向亸喾严嘤啭嗫嚣冁呓啰苏嘱囱囵国围园圆图团坝垭采执坚垩垴埚尧报场块茔垲埘涂冢坞埙尘堑垫坠堕坛坟垯墙垦坛垱埙压垒圹垆坛坏垄垅坜坝塆壮壶壸寿够梦伙夹奂奥奁夺奖奋姹妆姗奸娱娄妇娅娲妫㛀媪妈袅妪妩娴娴婳妫媭娆婵娇嫱嫒嬷嫔婴婶娘㛤娈孙学孪宫采寝实宁审写宽宠宝将专寻对导尴届尸屃屉屡层屦属冈峰岘岛峡崃昆岗仑峥岽岚岁㟥嵝崭岖嵚崂峤峣峄峃崄嵘岭屿岳岿峦巅岩巯卺帅师帐带帧帏㡎帼帻帜币帮帱并干几库厕厢厩厦庼荫厨厮庙厂庑废广廪庐厅弑吊弪张强别弹弥弯录汇彟彦雕彨佛后径从徕复征彻恒耻悦悮怅闷凄恶恼恽恻爱惬悫怆恺忾栗态愠惨惭恸惯悫怄怂虑悭庆㥪戚欲忧惫怜凭愦慭惮愤悯怃宪忆恳应怿懔蒙怼懑㤽恹惩懒怀悬忏惧慑恋戆戋戗戬战戯戏户捍抛拼捝挲挟舍扪挨卷扫抡㧏挜挣挂采拣扬换挥搄损摇捣扇揾抢掴掼搂挚抠抟折掺捞挦撑挠㧑挢掸拨抚扑揿挞挝捡拥掳择击挡㧟担据挤抬捣拟摈拧搁掷扩撷摆擞撸㧰扰摅撵拢拦撄搀撺携摄攒挛摊搅揽教敚败叙敌数敛毙敩斓斩断于旗既升时晋昼晕晖旸畅暂晔历昙晓向暧旷昽晒书会胧术东拐栅拐查杆栀枧条枭棁弃棋枨枣栋㭎栈栖梾桠㭏杨枫桢业极矩干杩荣榅桤构枪杠梿椠椁椮桨椢椝桩乐枞梁楼标枢㭤样榝㭴桪朴树桦椫桡桥机椭横檩柽档桧槚检樯梼台槟柠槛柜橹榈栉椟橼栎橱槠栌枥橥榇蘖栊榉樱栏榉权椤栾榄棂钦叹欧欤欢岁历归殁残殒殇㱮殚僵殓殡㱩歼杀壳壳毁殴毵牦毡氇气氢氩氲泛泛污决没冲况溯泄汹浃泾涚凉凄泪渌净凌沦渊涞浅涣减沨涡测浑凑浈涌汤沩准沟温浉涢湿沧灭涤荥汇沪滞渗卤浒浐滚满渔溇沤汉涟渍涨溆渐浆颍泼洁沩㴋潜润浔溃滗涠涩浇涝沄涧渑泽滪泶浍淀㳠浊浓㳡湿泞溁蒙浕济涛㳔滥潍滨溅泺滤澛滢渎㲿泻沈浏濒泸沥潇潆潴泷濑弥潋澜沣滠洒漓滩灏㳕湾滦滟滟灾为乌烃无炼炜烟茕焕烦炀㶽煴荧炝热颎炽烨灯炖烧烫焖营灿毁烛烩㶶熏烬焘烁炉烂争为爷尔床墙牍抵牵荦牦犊牺状狭狈狰犹狲犸呆狱狮奖独狯猃狝狞㺍获猎犷兽獭献猕猡现雕珐珲玮玚琐瑶莹玛玱琏琎玑瑷珰㻅环玙瑸玺璇琼珑璎瓒瓯瓮产产亩毕画异画当畴叠痉酸疴痖疯疡痪瘗疮疟瘆疭瘘瘘疗痨痫瘅愈疠瘪痴痒疖症疬癞癣瘿瘾痈瘫癫发皂皑疱皲皱杯盗盏尽监盘卢荡真眦众困睁睐眍䁖瞒瞆睑蒙眬瞩矫朱硁硖砗砚埼硕砀砜确码䂵硙砖硵碜碛矶硗䃅硚础碍矿砺砾矾砻秘禄祸祯祎祃御禅礼祢祷秃籼税秆䅉棱禀种称谷䅟稣积颖秾穑秽稳获穞窝洼穷窑窎窭窥窜窍窦灶窃竖竞笔笋笕䇲个笺筝札节范筑箧筼筿笃筛筚箦篓蓑箪简篑箫筜签帘篮筹䉤箓篯箨籁笼签笾簖篱箩吁粤粽糁粪粮团粝籴粜纟纠纪纣约红纡纥纨纫纹纳纽纾纯纰纼纱纮纸级纷纭纴纺䌷扎细绂绁绅纻绍绀绋绐绌终弦组䌹绊绗结绝绦绔绞络绚给绒绖统丝绛绝绢绑绡绠绨绣绤绥䌼捆经综缍绿绸绻线绶维绹绾纲网绷缀彩纶绺绮绽绰绫绵绲缁紧绯绿绪绬绱缃缄缂线缉缎缔缗缘缌编缓缅纬缑缈练缏缇致缊萦缙缢缒绉缣缊缞缚缜缟缛县绦缝缡缩纵缧䌸纤缦絷缕缥总绩绷缫缪缯织缮缭绕绣缋绳绘系茧缰缳缲缴䍁绎继缤缱䍀颣缬纩续累缠缨才纤缵缆钵䓨坛罂坛罚骂罢罗罴羁芈群羟羡义膻习玩翚翘翙耧耢圣闻联聪声耸聩聂职聍听聋肃胁脉胫唇修脱胀肾胨脶脑肿脚肠腽腘肤䏝胶腻胆脍脓脸脐膑腊胪脏脔臜卧临台与兴举旧铺馆舱舣舰舻艰艳刍苎兹荆庄茎荚苋华庵烟苌莱万荝莴叶荭荮苇药荤搜莼莳蒀莅苍荪席盖莲苁莼荜卜参蒌蒋葱茑荫荨蒇荞荬芸莸荛蒉荡芜萧蓣蕰荟蓟芗姜蔷荙莶荐萨苧䓓苔荠蓝荩艺药薮䓖蕴苈蔼蔺萚蕲芦苏蕴苹藓蔹茏兰蓠萝蔂处虚虏号亏虬蛱蜕蚬蚀猬虾虱蜗蛳蚂萤䗖蝼螀蛰蝈螨虮蝉蛲虫蛏蚁蚃蝇虿蝎蛴蝾蚝蜡蛎蟏蛊蚕蛮众蔑术同胡卫冲衮夹袅里补装里制复裈袆裤裢褛亵裥裥袯袄裣裆褴袜摆衬袭襕核见觃规觅视觇觋觍觎亲觊觏觐觑觉览觌观觞觯触讠订讣计讯讧讨讦讱训讪讫托记讹讶讼䜣诀讷讻访设许诉诃诊注证诂诋讵诈诒诏评诐诇诎诅词咏诩询诣试诗诧诟诡诠诘话该详诜诙诖诔诛诓夸志认诳诶诞诱诮语诚诫诬误诰诵诲说说谁课谇诽谊訚调谄谆谈诿请诤诹诼谅论谂谀谍谞谝谥诨谔谛谐谏谕咨讳谙谌讽诸谚谖诺谋谒谓誊诌谎谜谧谑谡谤谦谥讲谢谣谣谟谪谬谫讴谨谩哗证谲讥谮识谯谭谱噪谵毁译议谴护诪誉谫读谉变詟䜩雠谗让谰谶赞谠谳溪岂竖丰艳猪豮狸猫䝙贝贞贠负财贡贫货贩贪贯责贮贳赀贰贵贬买贷贶费贴贻贸贺贲赂赁贿赅资贾贼赈赊宾赇赒赉赐赏赔赓贤卖贱赋赕质赍账赌䞐赖赗赚赙购赛赜贽赘赟赠赞赝赡赢赆赃赑赎赝赣赃赪赶赵趋趱迹践逾踊跄跸迹跖蹒踪跷跶趸踌跻跃䟢踯跞踬蹰跹蹑蹿躜躏躯车轧轨军轪轩轫轭软轷轸轱轴轵轺轲轶轼较辂辁辀载轾辄挽辅轻辆辎辉辋辍辊辇辈轮辌辑辏输辐辒辗舆辒毂辖辕辘转辙轿辚轰辔轹轳办辞辫辩农回径这连周进游运过达违遥逊递远溯适迟绕迁选遗辽迈还迩边逻逦郏邮郓乡邹邬郧邓郑邻郸邺郐邝酂郦腌酝丑酝蒏糖医酱酦酿衅酾酽释厘钅钆钇钌钊钉钋针钓钐扣钏钒钗钍钕钎䥺钯钫钘钭钥钚钠钝钩钤钣钑钞钮钧钟钙钬钛钪铌铈钶铃钴钹铍钰钸铀钿钾巨钻铊铉铇铋铂钷钳铆铅钺钵钩钲钼钽锫铏铰铒铬铪银铳铜铚铣铨铢铭铫铦衔铑铷铱铟铵铥铕铯铐铞锐销锈锑锉铝锒锌钡铤铗锋铻锊锓铘锄锃锔锇铓铺锐铖锆锂铽锍锯钢锞录锖锫锩铔锥锕锟锤锱铮锛锬锭锜钱锦锚锠锡锢错录锰表铼镎锝锨锪钫钔锴锳炼锅镀锷铡钖锻锽锸锲锘锹锾键锶锗针钟镁锿镅镑镰镕锁镉锤镈镃钨蓥镏铠铩锼镐镇镇镒镋镍镓鿔镌镎镞旋链镆镙镠镝铿锵镗镘镛铲镜镖镂錾镚铧镤镪䥽锈铙铴镣铹镦镡钟镫镢镨䦅锎锏镄镌镰䦃镯镭铁镮铎铛镱铸镬镔鉴鉴镲锧镴铄镳镥镧钥镵镶镊镩锣钻銮凿镢镋长门闩闪闫闬闭开闶闳闰闲闲间闵闸阂阁合阀闺闽阃阆闾阅阅阊阉阎阏阍阈阌阒板暗闱阔阕阑阇阗阘闿阖阙闯关阚阓阐辟阛闼陉陕升阵阴陈陆阳陧队阶陨际随险陦隐陇隶只隽虽双雏杂鸡离难云电沾霡雾霁雳霭叇灵叆靓静靔腼靥巩绱秋鞒缰鞑千鞯韦韧韨韩韪韬鞲韫韵响页顶顷项顺顸须顼颂颀颃预顽颁顿颇领颌颉颐颏头颒颊颋颕颔颈颓频颓颗题额颚颜颙颛颜愿颡颠类颟颢顾颤颥显颦颅颞颧风飐飑飒台刮飓飔飏飖飕飗飘飙飚飞饣饥饤饦饨饪饫饬饭飧饮饴饲饱饰饳饺饸饼糍饷养饵饹饻饽馁饿馂饾余肴馄馃饯馅馆糊糇饧喂馉馇馎饩馏馊馌馍馒馐馑馓馈馔饥饶飨餍馋馕马驭冯驮驰驯驲驳驻驽驹驵驾骀驸驶驼驷骂骈骇骃骆骎骏骋骍骓骔骒骑骐骛骗骙䯄骞骘骝腾驺骚骟骡蓦骜骖骠骢驱骅骕骁骣骄验惊驿骤驴骧骥骦骊骉肮髅脏体髌髋发松胡须鬓斗闹哄阋阄郁鬶魉魇鱼鱽鱾鲀鲁鲂鱿鲄鲅鲆鲌鲉鲏鲇鲐鲍鲋鲊鲒鲘鲞鲕䲟鲖鲔鲛鲑鲜鲓鲪鲝鲧鲠鲩鲤鲨鲬鲻鲯鲭鲞鲷鲴鲱鲵鲲鲳鲸鲮鲰鲶鲺鳀鲫鳊鳈鲗鳂䲠鲽鳇䲡鳅鲾鳄鳆鳃鳁鳒鳑鳋鲥鳏䲢鳎鳐鳍鳁鲢鳌鳓鳘鲦鲣鲹鳗鳛鳔鳉鳙鳕鳖鳟鳝鳜鳞鲟鲼鲎鲙鳣鳡鳢鲿鲚鳠鳄鲈鲡鸟凫鸠凫鸤凤鸣鸢䴓鸩鸨鸦鸰鸵鸳鸲鸮鸱鸪鸯鸭鸸鸹鸻䴕鸿鸽䴔鸺鸼鹀鹃鹆鹁鹈鹅鹄鹉鹌鹏鹐鹎雕鹊鹓鹍䴖鸫鹑鹒鹋鹙鹕鹗鹖鹛鹜䴗鸧莺鹟鹤鹠鹡鹘鹣鹚鹚鹢鹞鸡䴘鹝鹧鹥鸥鸷鹨鸶鹪鹔鹩鹫鹇鹇鹬鹰鹭鸴㶉鹯䴙鹱鹲鸬鹴鹦鹳鹂鸾卤咸鹾碱盐丽麦麸面面曲曲面么么黄黉点党黪霉黡黩黾鼋鼌鼍冬鼹齐斋赍齑齿龀龁龂龅龇龃龆龄出龈啮龊龉龋腭龌龙厐庞䶮龚龛龟䜤鿒';
  var TS_MAP = null;
  function hansify(s) {
    if (!s) return s;
    if (!TS_MAP) {
      TS_MAP = {};
      for (var i = 0; i < TS_FROM.length; i++) TS_MAP[TS_FROM.charAt(i)] = TS_TO.charAt(i);
    }
    var out = '', n = s.length;
    for (var j = 0; j < n; j++) {
      var c = s.charAt(j), k = TS_MAP[c];
      out += (k === undefined ? c : k);
    }
    return out;
  }
  /* 只对「正文里要显示的文字」做转换，不动数据本身 */
  function showText(s) { return Number(CFG.hans) === 1 ? hansify(s) : s; }

  var THEMES = ['dark', 'light', 'sepia', 'green', 'gray', 'black'];
  /* 分栏档位：auto 自动，其余是每屏固定几栏。
     three / four 只为兼容 1.9 早期配置，一律按双栏算 */
  var LAYN = { one: 1, two: 2, three: 2, four: 2 };
  var DEF = {
    theme: 'dark', lay: 'auto', motion: 0, fs: 19, lh: 1.85, pagew: 720, fw: 400, hans: 0,
    ff: 'serif', align: 'justify', sort: 'last', txtEnc: 'auto',
    /* --- 1.8 排版与阅读方式 --- */
    mode: 'page',          // scroll 滚动 / page 翻页（1.14.12 起默认翻页：点屏幕左右就翻）
    modeRev: 0,            // 「默认翻页」迁移标记，只跑一次
    modeTouched: 0,        // 自己动过阅读方式就一直听你的，不再跟着默认值变
    tapTip: 0,             // 「点中间收放工具栏」的一次性提示是否已看过
    ps: 0.85,              // 段间距（em）
    ls: 0.02,              // 字间距（em）
    indent: 0,             // 首行缩进（em）
    padw: 32,              // 左右页边距（px）
    pageAnim: 'slide',     // slide / fade / none
    dim: 0,                // 亮度暗化 0~0.55
    customBg: '', customTx: '',
    autoScrollSpeed: 3,    // 自动滚动速度 1~10
    autoPageSec: 20,       // 自动翻页停留秒数
    immersive: 0,
    showClock: 1,          // 顶栏显示时间与本次阅读时长
    restMin: 45,           // 连续阅读多久提醒休息（0 = 不提醒）
    netPath: '',           // 上次用过的网络位置（SMB / 映射盘 / 本地路径）
    rate: 1, pitch: 1, volume: 1, voiceURI: '', voiceAuto: 1, pause: 120, whole: 1,
    autoNext: 1, follow: 1,
    /* 1.14.40 起成品不带 22 kHz 主角，默认旁白换成精选里的「成年女 1」（s13）。
       引擎在线时以 /health 的 default 为准，这里只是没连上引擎时的兜底。 */
    localOn: 1, localPort: 8177, localVoice: 's13',
    /* 英文语音（安卓那套 LJSpeech 模型）：默认开——中文书里夹英文词太常见。
       留这个开关是因为它在个别设备上会卡在 native 里（见 TtsEngine.ensureEn），
       关掉就是彻底不加载、不合成英文，中文一点不受影响。 */
    enVoice: 1,
    /* 男声降噪：0 原声 / 1 更干净 / 2 更清楚。只对男声生效，女声一个采样都不碰。
       默认「原声」。实测结论：手机喇叭外放时男声本来就很清楚，那点「沙沙」要接
       功放或高解析耳机才明显；一上来就压，反倒是把字压闷了，用户听到的是损失。
       所以默认不处理，觉得吵的自己往上调——选择权给用户，不替他决定。 */
    dnMode: 0,
    /* 朗读条置顶：从「全部」里挑过的声线记在这里，可增可删。以前只记当前那一个，
       选第二个就把第一个挤掉，所以看着像「加了又被删」。 */
    pinVoices: [],
    /* 分角色时男女主角各用哪一条声线。空 = 还没定，由 fixLead() 按模式补默认。
       以前男女主是靠角色池顺序发出来的，而池子头一个是 s124（118 Hz 老生·低沉），
       于是全书男主一开口就是最沉那嗓子。现在主角单独一条，绕开池子。 */
    leadM: '', leadF: '',
    /* 旁白也分男/女两条：书不一样，有的适合女声娓娓道来，有的适合男声沉稳。
       两条都记住，设置页/朗读条一键换，换书不用重新翻一遍声线表。
       空 = 还没定，由 fixNarr() 按模式补默认。 */
    narrM: '', narrF: '',
    /* 首次启动的「挑一个声音」只弹一次。0 = 还没弹过 */
    introRev: 0,
    /* 1.14.23 起声线范围默认「全部」：让用户一进设置就能挑到全部音色，
       不必先切一次范围。精选仍然保留，作为「不想挑就用这几个」的推荐位。 */
    voiceSet: 'all', voiceSetRev: 0,
    /* 分角色是否动用全库（187 人那套比精选慢）。与「声线范围」脱钩：
       范围只管下拉里列什么，这里才决定合成走哪套库。 */
    roleWide: 0,
    roleOn: 1, rolePool: 'mix', roleTouched: 0,
    voiceRev: 0,           // 音色体系迁移标记：1.13 起默认换成 x0（小雅 22 kHz）
    /* 启动时自动查新版本：1.11.1 起才有。默认 0，守「默认零联网」这条 */
    updChk: 0,
    lang: 'zh', noteFilter: 'all'
  };
  var CFG = Object.assign({}, DEF), BOOKS = [], BK = null, URLCACHE = {}, ACTIVE_ZIP = null, ZIPSEQ = 0;
  /* 男声降噪三档的显示名。引擎侧对应 denoise.py 的 MODE_OFF / MODE_HARD / MODE_DD。
     名字按「听起来是什么」取，不用算法名：谱减 / 判决导向这种词只有开发者看得懂。 */
  var DN_NAME = { 0: '原声', 1: '更干净', 2: '更清楚' };
  var SIDE = 'toc', SEARCHTOK = 0;
  var SYN = window.speechSynthesis || null, UTT = window.SpeechSynthesisUtterance || null;
  var DB = null;

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function fmtDate(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  var toastT = null;
  function toast(msg, ms) {
    var e = $('toast'); e.textContent = msg; e.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove('on'); }, ms || 2600);
  }
  function download(name, text, mime) {
    var u = URL.createObjectURL(new Blob([text], { type: mime || 'application/json;charset=utf-8' }));
    var a = document.createElement('a'); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
  }
  function b64(buf) {
    var u = new Uint8Array(buf), s = '', CH = 0x8000, i;
    for (i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- SHA-256（纯 JS） ----------------
     只为「内容指纹」服务。不用 crypto.subtle：安卓页面从 127.0.0.1 进来算安全上下文，
     但网页版被另存成 file:// 打开时就是 undefined。指纹一半设备算得出来、另一半算不出来，
     同步直接废掉，所以自带一份，谁也不靠。 */
  var SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function sha256Hex(u8) {
    var ml = u8.length;
    var blocks = ((ml + 8) >> 6) + 1;
    var pad = new Uint8Array(blocks * 64);
    pad.set(u8);
    pad[ml] = 0x80;
    var hi = Math.floor(ml / 536870912), lo = (ml * 8) >>> 0;
    var e = blocks * 64;
    pad[e - 8] = (hi >>> 24) & 255; pad[e - 7] = (hi >>> 16) & 255;
    pad[e - 6] = (hi >>> 8) & 255; pad[e - 5] = hi & 255;
    pad[e - 4] = (lo >>> 24) & 255; pad[e - 3] = (lo >>> 16) & 255;
    pad[e - 2] = (lo >>> 8) & 255; pad[e - 1] = lo & 255;
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Int32Array(64), i, off;
    for (off = 0; off < e; off += 64) {
      for (i = 0; i < 16; i++) {
        w[i] = (pad[off + i * 4] << 24) | (pad[off + i * 4 + 1] << 16) |
               (pad[off + i * 4 + 2] << 8) | pad[off + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], f = H[4], g = H[5], hh = H[6], k = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((f >>> 6) | (f << 26)) ^ ((f >>> 11) | (f << 21)) ^ ((f >>> 25) | (f << 7));
        var ch = (f & g) ^ (~f & hh);
        var t1 = (k + S1 + ch + SHA_K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        k = hh; hh = g; g = f; f = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + f) | 0; H[5] = (H[5] + g) | 0; H[6] = (H[6] + hh) | 0; H[7] = (H[7] + k) | 0;
    }
    return H.map(function (v) { return ('0000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }
  function utf8Bytes(s) {
    var out = [], i, c, c2, cp;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length &&
               (c2 = s.charCodeAt(i + 1)) >= 0xdc00 && c2 <= 0xdfff) {
        cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        i++;
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  /* 同一本书在两台机器上要认得出是同一本，靠的就是这个 key：
     体积 + 规范化书名 + 首尾各 8 KB 的摘要。不 hash 全书——20 MB 的书在手机上
     要几百毫秒，导入本来就慢，不值这个时间；而体积加首尾已经足够区分。 */
  function normBookName(s) {
    return String(s || '').toLowerCase().replace(/\.[^.]+$/, '')
      .replace(/[\s_\-·・.,，。:：;；!！?？()（）\[\]【】〔〕《》<>'"“”‘’+&@#]/g, '');
  }
  function bookKey(buf, name, size) {
    var u = (buf && buf.byteLength !== undefined && !(buf instanceof Uint8Array))
      ? new Uint8Array(buf) : buf;
    if (!u || u.length === undefined) return '';
    var n = u.length || (Number(size) || 0);
    var m = Math.min(8192, n);
    var tag = utf8Bytes(normBookName(name) + '|' + n + '|');
    var all = new Uint8Array(tag.length + m * 2);
    all.set(tag, 0);
    all.set(u.subarray(0, m), tag.length);
    if (m) all.set(u.subarray(n - m, n), tag.length + m);
    return n.toString(36) + '-' + sha256Hex(all).slice(0, 16);
  }
  /* 1.14.28 之前导入的书没有 key。补算要读一遍文件，慢，所以放后台一本一本过：
     算过就写回，读不到文件（丢了）就跳过，下次同步前再试。 */
  var KEYBUSY = 0;
  async function ensureKeys(quiet) {
    if (KEYBUSY) return 0;
    var todo = BOOKS.filter(function (b) { return b && !b.key; });
    if (!todo.length) return 0;
    KEYBUSY = 1;
    var n = 0;
    for (var i = 0; i < todo.length; i++) {
      try {
        var rec = await dbGet('blobs', todo[i].id);
        if (!rec || !rec.buf) continue;
        todo[i].key = bookKey(rec.buf, todo[i].name, todo[i].size);
        if (!todo[i].key) continue;
        await dbPut('books', todo[i]);
        n++;
        if (n % 3 === 0) await sleep(0);      // 让出主线程，别卡着滚动
      } catch (e) { /* 单本失败不影响其他 */ }
    }
    KEYBUSY = 0;
    if (n && !quiet) toast(T('已为 {n} 本书建立同步指纹', { n: n }), 2400);
    return n;
  }
  /* 导入同一本书时（换了机器、或本机删了又导回来、或同步先到了进度），
     把旧条目的进度与笔记接过来。认的是内容指纹，跟文件名、跟 id 都无关。 */
  function adoptByKey(meta) {
    if (!meta.key) return '';
    var prev = BOOKS.filter(function (x) { return x.key === meta.key; })[0];
    if (!prev) return '';
    meta.ch = prev.ch || 0; meta.ratio = prev.ratio || 0; meta.progress = prev.progress || 0;
    meta.marks = (prev.marks || []).slice(); meta.hl = (prev.hl || []).slice();
    meta.fav = prev.fav || 0; meta.rt = prev.rt || 0; meta.sessions = prev.sessions || 0;
    meta.first = prev.first || meta.first;
    if (prev.group) meta.group = prev.group;
    if (prev.added) meta.added = prev.added;
    var i = BOOKS.indexOf(prev);
    if (i >= 0) BOOKS.splice(i, 1);
    dbDel('books', prev.id).catch(function () { });
    dbDel('blobs', prev.id).catch(function () { });
    return prev.name || '';
  }

  /* ---------------- IndexedDB：元数据与书籍二进制分库 ---------------- */
  function openDB() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' });
      };
      r.onsuccess = function (e) { DB = e.target.result; res(DB); };
      r.onerror = function (e) { rej(e.target.error); };
    });
  }
  function tx(store, mode, fn) {
    return openDB().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), q = fn(s);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function dbPut(s, v) { return tx(s, 'readwrite', function (o) { return o.put(v); }); }
  function dbGet(s, k) { return tx(s, 'readonly', function (o) { return o.get(k); }); }
  function dbAll(s) { return tx(s, 'readonly', function (o) { return o.getAll(); }); }
  function dbDel(s, k) { return tx(s, 'readwrite', function (o) { return o.delete(k); }); }

  /* ---------------- 配置 ---------------- */
  function loadCfg() {
    var raw = null;
    try { raw = localStorage.getItem(CFGKEY); } catch (e) { /* 隐私模式 */ }
    try { var o = JSON.parse(raw || '{}'); Object.keys(DEF).forEach(function (k) { if (o[k] !== undefined) CFG[k] = o[k]; }); }
    catch (e) { /* 用默认值 */ }
    // 1.7 及以前：lay 是「界面密度」(auto/p/l)，1.8 起改成「分栏」(auto/one/two)
    if (CFG.lay === 'p' || CFG.lay === 'l') CFG.lay = 'auto';
    // 分角色朗读 1.9.4 起默认开：从没手动关过的老配置也跟着开一次（有引擎才生效，没引擎自动回落）
    if (!CFG.roleTouched) CFG.roleOn = 1;
    // 置顶声线必须是字符串数组（老配置里没有这个键，也可能是被手改过的脏值）。
    // 性别配额要等引擎报上档位才能判，这里只做类型过滤 + 总上限，剩下交给 fixPinBalance()。
    if (!Array.isArray(CFG.pinVoices)) CFG.pinVoices = [];
    else CFG.pinVoices = CFG.pinVoices.filter(function (k) { return typeof k === 'string' && k; }).slice(0, 20);
    /* 新装的默认置顶：6 条精选真人声线（女 3 + 男 3）。
       1.14.27 那会儿补的是六个音高变体，可那六个都是同一个人的四种音高，
       拿来做新用户的默认推荐太单薄——现在精选里有 50 个真人，就换成真人。
       老配置有 pinSeedRev 记着，一个都不会被改。这里仍用常量键名：
       loadCfg 跑的时候引擎还没探测，拿不到声线表。 */
    if (!CFG.pinSeedRev) {
      CFG.pinSeedRev = 2;
      var seed = Array.isArray(CFG.pinVoices) ? CFG.pinVoices.slice() : [];
      ['s13', 's129', 's36', 's32', 's58', 's174'].forEach(function (k) {
        if (seed.indexOf(k) < 0) seed.push(k);
      });
      CFG.pinVoices = seed;
      saveCfg();
    }
    // 男声降噪档位：设置里存回来是字符串，engine 那边要数字；0/1/2 之外一律按原声。
    CFG.dnMode = [0, 1, 2].indexOf(Number(CFG.dnMode)) >= 0 ? Number(CFG.dnMode) : 0;
    // 1.14.23 起声线范围默认放开到「全部」：老配置里存的 'curated' 也跟一次。
    // 用户之后自己切回「精选」就记住，不再反复改。
    if (!CFG.voiceSetRev) {
      CFG.voiceSetRev = 1;
      if (CFG.voiceSet === 'curated') CFG.voiceSet = 'all';
      saveCfg();
    }
    // 1.13 起默认音色换成小雅（x0，22.05 kHz）。老配置如果还停在旧的默认 s12，
    // 跟着换一次；自己挑过别的声线就不动，后面 voiceRev=1 也不再打扰。
    if (!CFG.voiceRev) {
      CFG.voiceRev = 1;
      if (CFG.localVoice === 's12') CFG.localVoice = 'x0';
      saveCfg();
    }
    // 1.14.12 起默认「翻页」：手机没有键盘和滚轮，点屏幕左右就翻最省事。
    // 老配置只要没自己动过阅读方式，跟着切一次；动过的保持原样。
    if (!CFG.modeRev) {
      CFG.modeRev = 1;
      if (!CFG.modeTouched) CFG.mode = 'page';
      saveCfg();
    }
    // 头一次在手机上打开（还没存过任何配置）：桌面那套 19px 字号 + 32px 边距，
    // 到 390 宽的屏上两边吃掉 64px、一行剩不到二十字，读着憋。按窄屏重给一套。
    if (!raw) tuneNarrowDefaults();
    if (I18N) I18N.set(CFG.lang);
    applyCfg();
  }
  /* 窄屏首启的排版基线。只在「从没保存过配置」时生效，用户自己调过就完全听用户的。 */
  function tuneNarrowDefaults() {
    var w = window.innerWidth || 390;
    if (w > 860) return;
    CFG.fs = w < 360 ? 17 : 18;   // 小屏再收一号，免得一行只剩十三四字
    CFG.lh = 1.9;
    CFG.padw = w < 360 ? 14 : 18;
    CFG.ps = 0.75;
  }
  function saveCfg() { try { localStorage.setItem(CFGKEY, JSON.stringify(CFG)); } catch (e) { /* 隐私模式 */ } }
  function applyCfg() {
    CFG.hans = Number(CFG.hans) ? 1 : 0;      // '0' 是 truthy，必须转成数字
    var h = document.documentElement, s = h.style;
    /* 双栏必须靠翻页成立：一屏高度固定，超出的内容才会向右排成新列。
       滚动模式没有固定屏高，column-count 摆出来是两列同步滚动，读起来会串行，所以强制走翻页。 */
    if ((LAYN[CFG.lay] || 0) > 1 && CFG.mode !== 'page') CFG.mode = 'page';
    /* 图片层 PDF 一律滚动：整页一张图，切栏会把人像劈成两半。CFG.mode 不改，离开这本书还是原设置。 */
    var nowPage = CFG.mode === 'page' && !(BK && BK.picture), wasPage = h.getAttribute('data-mode') === 'page';
    /* 切换阅读方式时先抓住眼前那段，切完再定位回去，别让人丢位置 */
    var keep = BK ? (wasPage ? pgTopPara() : scrollTopPara()) : null;
    h.setAttribute('data-theme', CFG.theme);
    h.setAttribute('data-lay', CFG.lay);
    h.setAttribute('data-mode', nowPage ? 'page' : 'scroll');
    h.setAttribute('data-motion', CFG.motion ? 'low' : '');
    s.setProperty('--fs', Number(CFG.fs) + 'px');
    s.setProperty('--lh', CFG.lh);
    s.setProperty('--pagew', Number(CFG.pagew) + 'px');
    s.setProperty('--ff', FONTS[CFG.ff] || FONTS.serif);
    s.setProperty('--ps', Number(CFG.ps) + 'em');
    s.setProperty('--ls', Number(CFG.ls) + 'em');
    s.setProperty('--fw', String(CFG.fw || 400));
    s.setProperty('--ind', Number(CFG.indent) + 'em');
    s.setProperty('--padx', Number(CFG.padw) + 'px');
    // 自定义底色 / 字色：空 = 跟随主题
    var paper = String(CFG.customBg || '').trim(), tx = String(CFG.customTx || '').trim();
    if (paper) s.setProperty('--paper', paper); else s.removeProperty('--paper');
    if (tx) { s.setProperty('--paperTx', tx); s.setProperty('--tx', tx); }
    else { s.removeProperty('--paperTx'); s.removeProperty('--tx'); }
    $('page').style.textAlign = CFG.align;
    if ($('dim')) $('dim').style.opacity = Math.max(0, Math.min(0.6, Number(CFG.dim) || 0));
    var i = $('spRate'); if (i) { i.value = CFG.rate; $('spRateTx').textContent = Number(CFG.rate).toFixed(1) + '×'; }
    syncAutoBtn(); syncFullBtn(); clkPaint(); applyImm();
    // 排版变化后：翻页模式重新分页（尽量停在原来那段），滚动模式清掉分页残留
    if (!pgEnabled()) {
      pgReset();
      if (BK && nowPage !== wasPage && keep) {
        try { keep.scrollIntoView({ block: 'start' }); } catch (e) { }
      }
    } else if (BK) {
      PG.ready = 0; pgMeasure();
      pgTo(keep ? paraPage(keep) : PG.i, { instant: true });
    }
  }
  /* ---------------- 语言 ---------------- */
  function syncLangBtn() {
    var b = $('btnLang'); if (!b) return;
    b.textContent = CFG.lang === 'en' ? '中' : 'EN';
    b.title = T('切换界面语言');
    b.setAttribute('aria-label', b.title);
  }
  function syncTypeBtn() {
    var b = $('btnType'); if (!b) return;
    b.textContent = T('排版');
    b.title = T('排版：滚动 / 翻页、分栏、字号、行距、段距、字体、颜色');
    b.setAttribute('aria-label', b.title);
  }
  function setLang(l) {
    CFG.lang = (l === 'en' ? 'en' : 'zh');
    if (I18N) I18N.set(CFG.lang);
    saveCfg();
    if (I18N) I18N.apply();
    syncLangBtn();
    document.documentElement.setAttribute('lang', CFG.lang === 'en' ? 'en' : 'zh-CN');
    // 动态生成的部分重新渲染一遍，静态部分由 I18N.apply() 刷
    renderShelf();
    if (BK) { renderChapter(BK.ch, { silent: true }); renderSide(); }
    fillVoices(); syncRoleBtn(); voiceBadge(localReady() ? null : curVoice());
    hideSelTools();
    toast(T('界面语言已切换为 {n}', { n: CFG.lang === 'en' ? 'English' : '中文' }), 1800);
  }
  var THEME_NAME = { dark: '夜间', light: '明亮', sepia: '羊皮纸', green: '护眼绿', gray: '雾蓝', black: '纯黑' };
  function cycleTheme() {
    CFG.theme = THEMES[(THEMES.indexOf(CFG.theme) + 1) % THEMES.length]; saveCfg(); applyCfg();
    toast(T('主题：{n}', { n: T(THEME_NAME[CFG.theme] || CFG.theme) }));
  }
  function setTheme(k) {
    if (THEMES.indexOf(k) < 0) return;
    CFG.theme = k; saveCfg(); applyCfg();
    toast(T('主题：{n}', { n: T(THEME_NAME[k]) }), 1400);
  }
  /* 每套主题的「纸色 / 字色 / 主色」，只给主题面板画预览用 */
  var TH_PAL = {
    dark: { bg: '#1F2125', tx: '#E6E4E1', ac: '#4A9EFF' },
    light: { bg: '#FFFFFF', tx: '#22252B', ac: '#1668C4' },
    sepia: { bg: '#FAF3E3', tx: '#3B3226', ac: '#9A5B2C' },
    green: { bg: '#F3F8EC', tx: '#26301D', ac: '#3E7C4C' },
    gray: { bg: '#252D37', tx: '#DEE5EE', ac: '#69A8F5' },
    black: { bg: '#000000', tx: '#C4C4C8', ac: '#5AA9FF' }
  };
  /* 主题面板：先看后点、选定即生效 —— 不再「按一次换一档」 */
  function showTheme() {
    var cards = THEMES.map(function (k) {
      var p = TH_PAL[k] || TH_PAL.dark;
      return '<button class="thCard' + (CFG.theme === k ? ' on' : '') + '" data-th="' + k + '"' +
        ' style="background:' + p.bg + ';color:' + p.tx + ';border-color:' + p.ac + '">' +
        '<i class="dot" style="background:' + p.ac + '"></i>' +
        '<b>' + esc(T(THEME_NAME[k])) + '</b>' +
        '<span class="demo">春眠不觉晓</span>' +
        '<span class="tick">✓</span></button>';
    }).join('');
    var cbg = hex6(CFG.customBg, hex6(curVar('--paper'), '#1F2125'));
    var ctx = hex6(CFG.customTx, hex6(curVar('--paperTx'), '#E6E4E1'));
    var h = '<div class="thGrid">' + cards + '</div>' +
      '<div class="row clrRow"><label>' + T('自定义颜色') + '</label>' +
      '<span class="kv">' + T('底色') + '</span><input type="color" data-set="customBg" value="' + cbg + '">' +
      '<span class="kv">' + T('字色') + '</span><input type="color" data-set="customTx" value="' + ctx + '">' +
      '<button data-act="clr">' + T('清空') + '</button><span class="kv">' + T('清空后跟随主题') + '</span></div>' +
      '<div class="row"><label>' + T('亮度') + '</label><input type="range" data-set="dim" min="0" max="0.55" step="0.05" value="' +
      (Number(CFG.dim) || 0) + '" style="flex:1"><span id="fDim">' + Math.round((Number(CFG.dim) || 0) * 100) + '%</span></div>' +
      '<p class="kv">' + T('点一下立刻换上，自动记住。字号 / 行距 / 分栏在「更多排版」里。') + '</p>';
    showModal(T('主题'), h, [
      { label: T('更多排版…'), fn: function () { showType(); } },
      { label: T('完成'), cls: 'pri' }]);
    var mb = $('modalBody');
    mb.onclick = function (e) {
      var th = e.target.closest('[data-th]');
      if (th) { setTheme(th.getAttribute('data-th')); showTheme(); return; }
      if (e.target.closest('[data-act="clr"]')) {
        CFG.customBg = ''; CFG.customTx = ''; saveCfg(); applyCfg(); showTheme();
        toast(T('已跟随主题配色'), 1500);
      }
    };
    mb.oninput = function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      if (k === 'dim') {
        CFG.dim = parseFloat(e.target.value) || 0;
        if ($('fDim')) $('fDim').textContent = Math.round(CFG.dim * 100) + '%';
      } else CFG[k] = e.target.value;
      saveCfg(); applyCfg();
    };
  }
  function cycleLayout() {
    var a = ['auto', 'one', 'two'];
    CFG.lay = a[(a.indexOf(CFG.lay) + 1) % a.length]; saveCfg(); applyCfg();
    syncTypeBtn();
    toast(T('分栏：{n}', { n: T({ auto: '自动', one: '单栏', two: '双栏' }[CFG.lay] || '自动') }));
  }

  /* 点顶栏时钟：看时长、开关显示、调休息提醒间隔 */
  function showClockPanel() {
    var now = new Date();
    var hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var b = function (key, v, label, on) {
      return '<button data-ck="' + key + '" data-v="' + v + '"' + (on ? ' class="on"' : '') + '>' + label + '</button>';
    };
    var h = '<div class="clkBig"><b>' + hm + '</b><span>' + T('本次已读 {n}', { n: fmtRead(clkTotal()) }) + '</span></div>' +
      '<div class="row"><label>' + T('顶栏时钟') + '</label><div class="seg">' +
      b('showClock', 1, T('显示'), !!Number(CFG.showClock)) +
      b('showClock', 0, T('隐藏'), !Number(CFG.showClock)) + '</div></div>' +
      '<div class="row"><label>' + T('休息提醒') + '</label><div class="seg">' +
      b('restMin', 0, T('关闭'), !Number(CFG.restMin)) +
      [30, 45, 60, 90].map(function (n) {
        return b('restMin', n, T('{n} 分钟', { n: n }), Number(CFG.restMin) === n);
      }).join('') + '</div></div>' +
      '<p class="kv">' + T('时长只算真正在读的时间：回书架、切走窗口都会停表。连续读满设定时长会提醒你休息。') + '</p>';
    showModal(T('阅读时钟'), h, [
      { label: T('重新计时'), fn: function () { restTake(); showClockPanel(); } },
      { label: T('完成'), cls: 'pri' }]);
    $('modalBody').onclick = function (e) {
      var x = e.target.closest('[data-ck]'); if (!x) return;
      var k = x.getAttribute('data-ck'), v = parseInt(x.getAttribute('data-v'), 10) || 0;
      CFG[k] = v; saveCfg(); applyCfg();
      if (k === 'restMin') { CLK.mark = clkTotal(); CLK.warned = 0; CLK.snoozeTo = 0; }
      showClockPanel();
    };
  }

  /* ================= 分页引擎（翻页模式） =================
     用 CSS 多栏 + translateX 平移：column-fill:auto 会把超出高度的内容
     继续往右排成新列，#pageWrap 负责裁掉，翻页只是横向平移。 */
  var PG = { i: 0, count: 1, cols: 1, cw: 0, gap: 0, padL: 0, step: 0, ready: 0 };

  /* 图片页整页就是一张图，再切两栏只会把人像劈成两半：这类书一律滚动看 */
  function pgEnabled() { return CFG.mode === 'page' && !(BK && BK.picture); }
  /* 主指针是手指（手机 / 平板）：这类设备没有键盘和滚轮，
     滚动模式下也要允许「点两侧翻一屏」，否则只能一直滑。 */
  function touchy() {
    try { return window.matchMedia('(pointer: coarse)').matches; }
    catch (e) { return (navigator.maxTouchPoints || 0) > 0; }
  }
  /* 每屏几栏：只有单栏和双栏。auto 够宽就双栏，手机一律单栏 */
  /* 真正可用的宽度：容器父级减掉侧栏。不能用 #pageWrap.clientWidth——
     它已经被上一轮的 --pcols 限宽了，拿它做判断会越算越窄。 */
  function pgAvailW() {
    var rm = $('readMain');
    var w = rm ? rm.clientWidth : (window.innerWidth || 800);
    var side = $('side');
    if (side && side.classList.contains('on')) w -= side.offsetWidth || 0;
    return Math.max(240, w);
  }
  function pgCols() {
    if (!pgEnabled()) return 1;
    var w = pgAvailW();
    if (w < 620) return 1;                        // 手机一律单栏
    var pad = Math.max(10, Number(CFG.padw) || 32);
    var usable = w - pad * 2 + 60;                // 加上最后一个栏距，便于整除
    var want = LAYN[CFG.lay] || 0;
    if (!want) want = usable >= 880 ? 2 : 1;                                // 自动：够宽才双栏
    var maxFit = Math.max(1, Math.floor(usable / 360));                     // 双栏每栏至少 300px
    return Math.max(1, Math.min(want, maxFit, 2));
  }
  function pgGeo() {
    var el = $('page'), cs = getComputedStyle(el);
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var gap = parseFloat(cs.columnGap) || 0;
    var cols = pgCols();
    var contentW = Math.max(140, el.clientWidth - padL - padR);
    var cw = Math.max(60, (contentW - gap * (cols - 1)) / cols);
    return { padL: padL, padR: padR, gap: gap, cols: cols, cw: cw, step: cols * (cw + gap) };
  }
  /* 量一次：算出每列宽、总列数、总页数（用最后一块所在的列反推，最可靠） */
  function pgReset() {
    var el = $('page'); if (!el) return;
    el.style.columnCount = ''; el.style.transform = ''; el.style.removeProperty('--pcols');
    var wrap = $('pageWrap');
    if (wrap) { wrap.style.removeProperty('--pcols'); wrap.style.removeProperty('max-width'); }
    el.classList.remove('pg-slide', 'pg-fade');
    PG.cols = 1; PG.count = 1; PG.i = 0; PG.ready = 0;
  }
  /* 实测列距：把段落矩形的左缘聚类，相邻簇中位数之差就是「列宽 + 栏距」。
     比拿容器宽自己除更可靠——浏览器若因取整排出了半列，这里能立刻纠正步长。 */
  function pgRealStep() {
    var el = $('page'); if (!el) return 0;
    var list = el.querySelectorAll('.rdp'), n = Math.min(list.length, 160), lefts = [];
    for (var i = 0; i < n; i++) {
      var rs = list[i].getClientRects();
      for (var j = 0; j < rs.length; j++) if (rs[j].width > 40 && rs[j].height > 2) lefts.push(Math.round(rs[j].left));
    }
    if (lefts.length < 2) return 0;
    lefts.sort(function (a, b) { return a - b; });
    var groups = [[lefts[0]]];
    for (var k = 1; k < lefts.length; k++) {
      var g = groups[groups.length - 1];
      if (lefts[k] - g[g.length - 1] > 46) groups.push([lefts[k]]); else g.push(lefts[k]);
    }
    if (groups.length < 2) return 0;
    var med = function (a) { return a[a.length >> 1]; }, d = [];
    for (var m = 1; m < groups.length; m++) d.push(med(groups[m]) - med(groups[m - 1]));
    d.sort(function (a, b) { return a - b; });
    return d[d.length >> 1];
  }
  function pgMeasure(keepPos) {
    var el = $('page');
    if (!el) return PG;
    if (!pgEnabled()) { pgReset(); return PG; }
    var cols = pgCols();
    var wrap = $('pageWrap');
    if (wrap) wrap.style.setProperty('--pcols', cols);   // 容器靠它算 max-width
    el.style.removeProperty('--pcols');
    el.style.columnCount = cols;
    var keepX = keepPos ? el.style.transform : '';        // 量完要还原，别把页面闪回第一页
    el.style.transform = 'translateX(0px)';
    var m = pgGeo();
    var real = pgRealStep();                    // 实测「列宽 + 栏距」
    if (real > 80) { m.cw = Math.max(60, real - m.gap); m.step = m.cols * real; }
    var base = el.getBoundingClientRect().left + m.padL;
    var last = el.querySelector('#chEnd') || el.lastElementChild;
    var col = 0;
    if (last) {
      var rs = last.getClientRects();
      var r = rs.length ? rs[rs.length - 1] : last.getBoundingClientRect();
      // 除以「列宽 + 栏距」（单列步距），得到的是第几列；m.step 是一屏宽，别混用
      col = Math.max(0, Math.round((r.left - base) / (m.cw + m.gap)));
    }
    /* 交叉校验：多列布局下 scrollWidth 就是所有列的总宽，比「最后一块的 left」抗造。
       两个都算，取大的那个——算少了会让「下一页」误以为已经到章末，直接跳到下一章
       （用户投诉的「点下一页跳章节」就是这么来的）；算多的代价只是多一页空白。
       差值超过 3 列就当 scrollWidth 里有异常（滚动条宽度之类），不采信。 */
    if (el.scrollWidth > 0 && m.cw + m.gap > 1) {
      var byScroll = Math.round(el.scrollWidth / (m.cw + m.gap)) - 1;
      if (byScroll > col && byScroll <= col + 3) col = byScroll;
    }
    PG.cols = m.cols; PG.cw = m.cw; PG.gap = m.gap; PG.padL = m.padL; PG.step = m.step;
    PG.count = Math.max(1, Math.ceil((col + 1) / m.cols));
    if (PG.i > PG.count - 1) PG.i = PG.count - 1;
    PG.ready = 1;
    if (keepPos && keepX) el.style.transform = keepX;
    return PG;
  }
  function pgTo(i, opt) {
    opt = opt || {};
    if (!pgEnabled()) return;
    var el = $('page');
    if (!PG.ready) pgMeasure();
    PG.i = Math.max(0, Math.min(PG.count - 1, i | 0));
    var anim = !opt.instant && !CFG.motion && CFG.pageAnim !== 'none';
    var slide = anim && CFG.pageAnim === 'slide';
    el.classList.toggle('pg-slide', slide);
    el.style.transform = 'translateX(' + (-PG.i * PG.step) + 'px)';
    if (anim && CFG.pageAnim === 'fade') {
      el.classList.remove('pg-fade');
      void el.offsetWidth;
      el.classList.add('pg-fade');
    }
    updateProgress(); savePos();
  }
  /* 某个元素落在第几页 */
  function paraPage(p) {
    var el = $('page');
    if (!el || !p) return 0;
    var padL = PG.padL || 0;
    var base = el.getBoundingClientRect().left + padL;
    var r = p.getBoundingClientRect();
    var col = Math.round((r.left - base) / ((PG.cw || 1) + (PG.gap || 0)));
    col = Math.max(0, col);
    return Math.max(0, Math.min(PG.count - 1, Math.floor(col / (PG.cols || 1))));
  }
  /* 当前页第一个段落 */
  function pgTopPara() {
    var list = $('page') ? $('page').querySelectorAll('.rdp') : [];
    for (var i = 0; i < list.length; i++) if (paraPage(list[i]) === PG.i) return list[i];
    return null;
  }
  /* 滚动模式下：视口里第一个露头的段落（从滚动切到翻页时拿它当锚点） */
  function scrollTopPara() {
    var list = $('page') ? $('page').querySelectorAll('.rdp') : [];
    if (!list.length) return null;
    var box = $('pageWrap').getBoundingClientRect();
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.height && r.bottom > box.top + 6) return list[i];
    }
    return null;
  }
  /* 改字号 / 换屏宽后：重新分页，尽量停在原来那段 */
  function pgReflow(anchor) {
    if (!BK || !pgEnabled()) return;
    if (!anchor) anchor = pgTopPara();
    pgMeasure();
    pgTo(anchor ? paraPage(anchor) : PG.i, { instant: true });
  }
  /* 只在「页数真的变了」时才重排。
     插图、自定义字体都是异步到的，尺寸晚一步才定；不重排就可能把一章算成只有一页，
     于是点「下一页」直接跳到下一章。但又不能无条件重排——那样每次加载都闪一下。 */
  function pgReflowIfNeeded() {
    if (!BK || !pgEnabled() || !PG.ready) return;
    var anchor = pgTopPara(), before = PG.count, keep = PG.i;
    pgMeasure();
    if (PG.count !== before) {
      pgTo(anchor ? paraPage(anchor) : Math.min(keep, PG.count - 1), { instant: true });
    }
  }
  /* 本章的插图加载完（或失败）后补一次重排 */
  var imgWaitT = 0, imgPending = 0;
  function waitChapterImages() {
    if (!pgEnabled()) return;
    var imgs = $('page') ? $('page').querySelectorAll('img') : [];
    imgPending = 0;
    Array.prototype.forEach.call(imgs, function (im) {
      if (im.complete) return;
      imgPending++;
      var once = function () {
        if (imgPending > 0) imgPending--;
        if (imgPending === 0) {
          clearTimeout(imgWaitT);
          imgWaitT = setTimeout(pgReflowIfNeeded, 80);
        }
      };
      im.addEventListener('load', once, { once: true });
      im.addEventListener('error', once, { once: true });
    });
    // 兜底：没有图、或字体晚到时，也补一次（900ms 足够 web font 落地）
    clearTimeout(imgWaitT);
    imgWaitT = setTimeout(pgReflowIfNeeded, 900);
  }
  /* 正文区域宽度变了（开合侧栏、切换视图、窗口缩放）就必须重新量：
     列宽、列数、一屏步长全都跟着变；放着不管的话 translateX 还按旧步长走，
     翻一页就会停在「半截列」，右边一大片空白。 */
  var pgWaitT = 0;
  function pgAfterLayout(delay) {
    if (!BK || !pgEnabled()) return;
    clearTimeout(pgWaitT);
    pgWaitT = setTimeout(function () {
      var el = $('pageWrap');
      if (!el) return;
      // 用「可用宽度」而不是容器自身的宽度：容器被 --pcols 限宽了，看它会自锁，
      // 侧栏一收宽度回不去，就一直停在单栏。
      var key = pgAvailW() + 'x' + el.clientHeight;
      if (key === pgAfterLayout.lastKey && PG.ready) return;   // 尺寸没变，别白重排
      pgAfterLayout.lastKey = key;
      pgReflow();
    }, delay === undefined ? 220 : delay);
  }
  function pgWatch() {
    if (!window.ResizeObserver) return;
    var ro = new ResizeObserver(function () { pgAfterLayout(120); });
    ['pageWrap', 'readMain', 'side'].forEach(function (id) {
      var el = $(id); if (el) ro.observe(el);
    });
  }
  /* 把某段滚（翻）到眼前 */
  function revealPara(p, smooth) {
    if (!p) return;
    if (pgEnabled()) {
      var want = paraPage(p);
      if (want !== PG.i) pgTo(want, { instant: true });
      return;
    }
    try { p.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { p.scrollIntoView(); }
  }
  /* 下一页 / 下一屏（到末尾自动接下一章） */
  function readNext() {
    if (!BK) return;
    /* 图片层 PDF：一页就是一屏，滚动没有意义，直接翻页 */
    if (BK.picture) {
      if (BK.ch < chapterCount() - 1) renderChapter(BK.ch + 1);
      else toast(T('已经是最后一页'), 1500);
      return;
    }
    if (pgEnabled()) {
      if (PG.i < PG.count - 1) { pgTo(PG.i + 1); return; }
      /* 走到「以为的」最后一页时先复核一次页数：插图、字体晚到，或某些机型取整不同，
         都可能把一章算成一页。不复核就直接跳章，读者会莫名其妙丢掉一整个章节。 */
      var before = PG.count;
      pgMeasure(true);
      if (PG.count > before) { pgTo(Math.min(PG.i + 1, PG.count - 1)); return; }
      if (CFG.autoNext !== 0 && BK.ch < chapterCount() - 1) { renderChapter(BK.ch + 1); return; }
      toast(T('已经是最后一页'), 1500); return;
    }
    var w = $('pageWrap');
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 4) {
      if (CFG.autoNext !== 0 && BK.ch < chapterCount() - 1) renderChapter(BK.ch + 1);
      return;
    }
    w.scrollTop += w.clientHeight * 0.9;
  }
  function readPrev() {
    if (!BK) return;
    if (BK.picture) { if (BK.ch > 0) renderChapter(BK.ch - 1); return; }
    if (pgEnabled()) {
      if (PG.i > 0) { pgTo(PG.i - 1); return; }
      if (BK.ch > 0) renderChapter(BK.ch - 1, { pg: 'last' });
      return;
    }
    var w = $('pageWrap');
    if (w.scrollTop <= 2) { if (BK.ch > 0) renderChapter(BK.ch - 1); return; }
    w.scrollTop -= w.clientHeight * 0.9;
  }

  /* ================= 自动阅读 ================= */
  var AUTO = { on: 0, paused: 0, raf: 0, timer: 0, t0: 0, y: 0 };
  function autoSpeedPx() { return Math.max(1, Number(CFG.autoScrollSpeed) || 3) * 7; }
  function autoPageSec() { return Math.max(3, Number(CFG.autoPageSec) || 20); }
  function syncAutoBtn() {
    var b = $('btnAuto'); if (!b) return;
    b.classList.toggle('on', !!AUTO.on && !AUTO.paused);
    b.textContent = T('自动');
    b.title = AUTO.on ? T('自动阅读：开（再点关闭）') : T('自动阅读：自动滚动 / 自动翻页');
    b.setAttribute('aria-label', b.title);
  }
  function autoStopTimers() { if (AUTO.raf) cancelAnimationFrame(AUTO.raf); if (AUTO.timer) clearInterval(AUTO.timer); AUTO.raf = 0; AUTO.timer = 0; }
  /* 停留秒数改了：正在自动翻页的话立刻按新间隔重新计时，不用等这一页走完 */
  function autoRetime() {
    if (!AUTO.on || AUTO.paused || !pgEnabled()) return;
    if (AUTO.timer) clearInterval(AUTO.timer);
    AUTO.timer = setInterval(autoStepPage, autoPageSec() * 1000);
  }
  function autoStart() {
    if (!BK) return;
    autoStopTimers();
    AUTO.on = 1; AUTO.paused = 0; AUTO.t0 = 0;
    if (pgEnabled()) {
      AUTO.timer = setInterval(autoStepPage, autoPageSec() * 1000);
      toast(T('自动翻页：每 {n} 秒一页', { n: autoPageSec() }), 2600);
    } else {
      document.body.classList.add('autoscroll');
      AUTO.y = $('pageWrap').scrollTop || 0;      // 用浮点累加，避免每帧被取整吃掉
      AUTO.raf = requestAnimationFrame(autoStepScroll);
      AUTO.t0 = performance.now();
      var sec = Math.round((($('pageWrap') || {}).clientHeight || 600) / autoSpeedPx());
      toast(T('自动滚动：约 {n} 秒一屏', { n: sec }), 2600);
    }
    hidePill(); syncAutoBtn();
  }
  function autoStop(silent) {
    var was = AUTO.on;
    AUTO.on = 0; AUTO.paused = 0; autoStopTimers(); hidePill(); syncAutoBtn();
    document.body.classList.remove('autoscroll');
    if (!silent && was) toast(T('自动阅读：关'), 1600);
  }
  function autoPause() {
    if (!AUTO.on || AUTO.paused) return;
    AUTO.paused = 1; showPill(); syncAutoBtn();
  }
  function autoResume() {
    if (!AUTO.on) return;
    AUTO.paused = 0; AUTO.t0 = performance.now();
    AUTO.y = $('pageWrap').scrollTop || 0;
    hidePill(); syncAutoBtn();
  }
  function autoToggle() {
    if (!BK) { toast(T('先打开一本书')); return; }
    if (!AUTO.on) { autoStart(); return; }
    if (AUTO.paused) autoResume(); else autoPause();
  }
  function showPill() {
    var p = $('autoPill'); if (!p) return;
    if ($('autoPillTx')) $('autoPillTx').textContent = T('自动阅读已暂停');
    p.classList.add('on');
  }
  function hidePill() { var p = $('autoPill'); if (p) p.classList.remove('on'); }

  /* ================= 阅读时钟 / 本次时长 / 休息提醒 =================
     时长按「真正在读」累计：离开阅读界面、页面被切到后台都停表，
     回来接着算；隔了 10 分钟以上没读则重新起算。 */
  var CLK = { t0: 0, acc: 0, mark: 0, last: 0, timer: 0, snoozeTo: 0, warned: 0 };
  function clkTotal() { return CLK.acc + (CLK.t0 ? Date.now() - CLK.t0 : 0); }
  function fmtRead(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 60) return T('{n} 分钟', { n: m });
    return T('{a} 小时 {b} 分', { a: Math.floor(m / 60), b: m % 60 });
  }
  function clkPaint() {
    var el = $('clock'); if (!el) return;
    if (!Number(CFG.showClock)) { el.classList.add('off'); return; }
    el.classList.remove('off');
    var d = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var ms = clkTotal(), m = Math.floor(ms / 60000);
    // 窄屏顶栏要单行排下书名和按钮：<640 只留时间，640~900 用短写法的时长
    var narrow = (window.innerWidth || 0) < 900;
    var mini = (window.innerWidth || 0) < 640;
    el.textContent = mini ? hm
      : hm + ' · ' + (narrow ? T('{n} 分', { n: m }) : T('已读 {n}', { n: fmtRead(ms) }));
    el.title = T('当前时间 {t} · 本次已读 {n}', { t: hm, n: fmtRead(ms) });
    el.classList.toggle('warn', m >= 30 && m < 60);
    el.classList.toggle('tired', m >= 60);
    var fl = $('clockFloat');
    if (fl) { fl.textContent = hm + ' · ' + T('已读 {n}', { n: fmtRead(ms) }); fl.style.opacity = ''; }
  }
  function clkTick() {
    clkPaint();
    var rest = Number(CFG.restMin) || 0;
    if (!rest || !CLK.t0 || CLK.warned) return;
    if (Date.now() < CLK.snoozeTo) return;
    if (clkTotal() - CLK.mark < rest * 60000) return;
    CLK.warned = 1;
    showRest(rest);
  }
  function clkStart() {
    if (CLK.t0) return;
    // 上次读得太久以前（>10 分钟），这次重新起算
    if (CLK.last && Date.now() - CLK.last > 600000) { CLK.acc = 0; CLK.mark = 0; }
    CLK.t0 = Date.now();
    if (!CLK.timer) CLK.timer = setInterval(clkTick, 20000);
    clkPaint();
  }
  function clkStop(save) {
    if (CLK.t0) { CLK.acc += Date.now() - CLK.t0; CLK.t0 = 0; }
    CLK.last = Date.now();
    if (save !== false) clkPaint();
  }
  function clkReset() {
    CLK.acc = 0; CLK.mark = 0; CLK.snoozeTo = 0; CLK.warned = 0;
    hideRest(); clkPaint();
  }
  function showRest(min) {
    var t = $('restTip'); if (!t) return;
    if ($('restTipTx')) $('restTipTx').innerHTML = '<span class="ic">☕</span>' +
      esc(T('已连续阅读 {n}，抬头看看远处，喝口水吧。', { n: fmtRead(min * 60000) }));
    t.classList.add('on');
  }
  function hideRest() { var t = $('restTip'); if (t) t.classList.remove('on'); }
  function restTake() {
    autoStop(true); hideRest();
    CLK.warned = 0; CLK.mark = 0; CLK.acc = 0; CLK.snoozeTo = 0; CLK.last = 0;
    if (CLK.t0) CLK.t0 = Date.now();
    clkPaint();
    toast(T('已重新计时，读累了就歇会儿'), 2600);
  }
  function restSnooze() {
    hideRest();
    CLK.warned = 0; CLK.snoozeTo = Date.now() + 10 * 60000;
    CLK.mark = clkTotal();
    toast(T('10 分钟后再提醒'), 1800);
  }
  function autoStepPage() {
    if (!AUTO.on || AUTO.paused || document.hidden) return;
    if ($('modal').classList.contains('on') || $('side').classList.contains('on')) return;
    autoTurn();
  }
  function autoStepScroll(t) {
    if (!AUTO.on) return;
    if (AUTO.paused || document.hidden || $('modal').classList.contains('on')) {
      AUTO.t0 = t; AUTO.raf = requestAnimationFrame(autoStepScroll); return;
    }
    document.body.classList.add('autoscroll');
    var w = $('pageWrap');
    if (!w || !BK) { autoStop(true); return; }
    var dt = Math.min(220, t - (AUTO.t0 || t)); AUTO.t0 = t;
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 2) autoTurn();
    else { AUTO.y += autoSpeedPx() * dt / 1000; w.scrollTop = AUTO.y; }
    if (AUTO.on) AUTO.raf = requestAnimationFrame(autoStepScroll);
  }
  function autoTurn() {
    if (!BK) return;
    var lastCh = BK.ch >= chapterCount() - 1;
    if (pgEnabled()) {
      if (PG.i < PG.count - 1) { pgTo(PG.i + 1); return; }
      if (CFG.autoNext !== 0 && !lastCh) { renderChapter(BK.ch + 1, { silent: true }); return; }
      autoStop(true); toast(T('已到本章末尾，自动阅读已停止'), 2600); return;
    }
    var w = $('pageWrap');
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 2) {
      if (CFG.autoNext !== 0 && !lastCh) { renderChapter(BK.ch + 1, { silent: true }); return; }
      autoStop(true); toast(T('已到本章末尾，自动阅读已停止'), 2600); return;
    }
    w.scrollTop += w.clientHeight * 0.9;
  }

  /* ================= 全屏 / 沉浸 ================= */
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function inImm() { return document.body.classList.contains('imm'); }
  function syncFullBtn() {
    var b = $('btnFull'); if (!b) return;
    b.classList.toggle('on', inImm() || isFull());
    b.textContent = T((inImm() || isFull()) ? '退出' : '全屏');
    b.title = T('全屏 / 沉浸阅读');
    b.setAttribute('aria-label', b.title);
  }
  function applyImm() {
    var on = !!CFG.immersive && $('viewRead').classList.contains('on');
    document.body.classList.toggle('imm', on);
    if (!on) {
      $('readTop').classList.remove('peek'); $('readFoot').classList.remove('peek');
      document.body.classList.remove('barsOff');   // 退出全屏回到正常展开状态
    }
    syncFullBtn();
  }
  /* ---------- 收起 / 唤出上下工具栏 ----------
     手机上顶栏一直占着最上面那一条，读起来是真挤。点屏幕中间收起来，
     再点一下（或点屏幕最上面一条）唤回来；沉浸模式走同一套，只是用 peek。 */
  function barsVisible() {
    if (inImm()) return $('readTop').classList.contains('peek');
    return !document.body.classList.contains('barsOff');
  }
  function setBars(on) {
    var acts = $('readActs');
    if (acts && !on && acts.__shut) acts.__shut();   // 收工具栏时连带收起「⋯」面板
    if (inImm()) {
      $('readTop').classList.toggle('peek', !!on);
      $('readFoot').classList.toggle('peek', !!on);
      return;
    }
    document.body.classList.toggle('barsOff', !on);
  }
  function toggleBars() { setBars(!barsVisible()); }
  function toggleFull() {
    var next = !(inImm() || isFull());
    CFG.immersive = next ? 1 : 0; saveCfg(); applyImm();
    try {
      if (next) {
        var e = document.documentElement, fn = e.requestFullscreen || e.webkitRequestFullscreen;
        if (fn) { var r = fn.call(e); if (r && r.catch) r.catch(function () { }); }
      } else if (isFull()) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { var r2 = ex.call(document); if (r2 && r2.catch) r2.catch(function () { }); }
      }
    } catch (e) { /* 部分环境不支持全屏，沉浸照样生效 */ }
    setTimeout(function () { if (BK && pgEnabled()) pgReflow(); }, 220);
    toast(next ? T('全屏阅读：开（鼠标移到上下边缘唤出工具栏，Esc 退出）') : T('全屏阅读：关'), 2800);
  }


  /* ---------------- TXT / EPUB 解析 ---------------- */
  function isChapterTitle(t) {
    if (!t || t.length > 42) return false;
    var num = '0-9零〇一二三四五六七八九十百千两廿卅';
    if (new RegExp('^第\\s*[' + num + ']{1,12}\\s*[章节回卷部篇集话折出幕][\\s　:：、.．\\-—]*\\S{0,30}$').test(t)) return true;
    if (/^(Chapter|CHAPTER|chapter)\s+[0-9IVXLC]+[\s.:：\-—]*\S{0,30}$/.test(t)) return true;
    if (/^(卷|Volume|Part|PART|Book|BOOK)\s*[0-9零〇一二三四五六七八九十百千IVXLC]+[\s.:：\-—]*\S{0,30}$/.test(t)) return true;
    if (/^(序章|序言|自序|楔子|引子|前言|后记|尾声|番外|附录|目录|Contents|Epilogue|Prologue)[\s　:：.\-—]*\S{0,20}$/.test(t)) return true;
    if (new RegExp('^[【\\[]?第\\s*[' + num + ']{1,12}[章节回][】\\]]?').test(t) && t.length <= 36) return true;
    return false;
  }
  function splitLong(line, max) {
    var out = [], s = line;
    while (s.length > max) {
      var cut = max, i, punct = '。！？；!?;，,、';
      for (i = max; i > max * 0.55; i--) if (punct.indexOf(s.charAt(i)) >= 0) { cut = i + 1; break; }
      out.push(s.slice(0, cut)); s = s.slice(cut);
    }
    if (s.trim()) out.push(s);
    return out;
  }
  function buildTxt(buf, name) {
    var d = Z.decodeTxt(buf, CFG.txtEnc);
    var b = buildTxtText(d.text, name);
    b.enc = d.enc;
    return b;
  }
  /* 已经是纯文本的书（TXT 解码后、DOCX / MOBI / AZW3 抽出来之后）都走这里：
     认章节标题 → 分卷 → 组装成阅读器要的书对象。 */
  function buildTxtText(rawText, name) {
    var text = String(rawText || '').replace(/\r\n?/g, '\n').replace(/\uFEFF/g, '').replace(/\u3000/g, ' ');
    var lines = text.split('\n'), chapters = [], cur = { title: T('开篇'), lines: [] }, found = 0;
    lines.forEach(function (raw) {
      var t = raw.trim();
      if (isChapterTitle(t)) {
        found++;
        if (cur.lines.length || chapters.length) chapters.push(cur);
        cur = { title: t, lines: [] };
      } else if (t) cur.lines.push(t);
    });
    if (cur.lines.length || !chapters.length) chapters.push(cur);
    // 没有章节标题的书：按字数分卷；超大章节再切，保证渲染与朗读流畅
    var out = [];
    chapters.forEach(function (c) {
      if (!c.lines.length && out.length) return;
      var block = [], size = 0, part = 1;
      c.lines.forEach(function (ln) {
        splitLong(ln, 300).forEach(function (seg) {
          if (size + seg.length > (found ? 9000 : 6000) && block.length) {
            out.push({ title: c.title + (part > 1 ? '（' + part + '）' : ''), lines: block });
            part++; block = []; size = 0;
          }
          block.push(seg); size += seg.length;
        });
      });
      if (block.length) out.push({ title: c.title + (part > 1 ? '（' + part + '）' : ''), lines: block });
    });
    if (!out.length) out = [{ title: name, lines: [T('（空文件）')] }];
    var titles = out.map(function (c) { return c.title; });
    return {
      kind: 'txt', enc: '', count: out.length, titles: titles, cover: null,
      title: name, author: '', toc: titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; }),
      chapterHtml: function (i) {
        return out[i].lines.map(function (l) { return '<p class="rdp">' + esc(l) + '</p>'; }).join('\n');
      },
      chapterText: function (i) { return out[i].lines.join('\n'); }
    };
  }

  function els(doc, name) {
    var a = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS('*', name) : [];
    if (a && a.length) return a;
    return doc.getElementsByTagName(name);
  }
  function xmlText(doc, tag) {
    var a = els(doc, tag);
    return a.length ? (a[0].textContent || '').trim() : '';
  }
  function pathDir(p) { var a = String(p).split('/'); a.pop(); return a.join('/'); }
  function guessMime(p) {
    var e = (p.split('.').pop() || '').toLowerCase();
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', otf: 'font/otf', ttf: 'font/ttf',
      woff: 'font/woff', woff2: 'font/woff2', css: 'text/css' })[e] || 'application/octet-stream';
  }
  function assetURL(p, zip) {
    var z = zip || ACTIVE_ZIP || (BK && BK.zip);
    if (!z) return null;
    var real = z.find(p); if (!real) return null;
    if (!z.__myid) z.__myid = ++ZIPSEQ;
    var key = z.__myid + '|' + real;
    if (URLCACHE[key]) return URLCACHE[key];
    var b = z.read(real); if (!b) return null;
    var u = URL.createObjectURL(new Blob([b], { type: guessMime(real) }));
    URLCACHE[key] = u; return u;
  }
  function clearAssets() {
    Object.keys(URLCACHE).forEach(function (k) { try { URL.revokeObjectURL(URLCACHE[k]); } catch (e) {} });
    URLCACHE = {};
  }
  function rewriteCss(css, baseFile, zip) {
    var dir = pathDir(baseFile || '');
    css = css.replace(/@import[^;]*;/gi, '');
    css = css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, function (all, u) {
      if (/^(https?:|data:|blob:)/i.test(u)) return 'url()';
      var p = Z.resolvePath(dir, u), a = assetURL(p, zip);
      return a ? 'url("' + a + '")' : 'url()';
    });
    // 把 EPUB 样式限定在正文区，避免污染工具栏；字号/行距/颜色等一律交给用户设置。
    // 关键：书里的 body{...} 会落到 #page 这个「和阅读器同一个元素」上，
    // 如果放行 margin / padding / width，就会把阅读器的版心挤歪（曾导致双栏右栏被裁）。
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, function (all, sel, body) {
      if (/^\s*@/.test(sel)) return all;
      // 用户设置说了算的排版属性 + 书的盒模型，一律剥掉
      var clean = body.replace(/(^|;)\s*(font-size|font-family|line-height|color|background|background-color|text-align|text-indent|column-count|column-width|column-gap|column-fill|columns)\s*:[^;]*/gi, '$1');
      var s2 = sel.split(',').map(bookSel).join(',');
      // 直接命中正文容器本身（书里的 html/body/:root）→ 只留无害属性
      if (s2 === '#page') {
        clean = clean.replace(/(^|;)\s*(margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|width|max-width|min-width|height|max-height|float|position|inset|top|right|bottom|left|overflow)\s*:[^;]*/gi, '$1');
        if (!/[a-z-]+\s*:/i.test(clean)) return '';
      }
      return s2 + '{' + clean + '}';
    });
  }
  /* 把书里的选择器映射进正文区：body → #page，body p → #page p */
  function bookSel(x) {
    x = x.trim();
    if (!x) return x;
    if (x.indexOf('#page') === 0) return x;
    // 吃掉开头连续的 html / body / :root，只留层级后半段
    var rest = x, guard = 0;
    while (guard++ < 4) {
      var m = rest.match(/^(?::root|html|body)(?:\s*([>+~])\s*|\s+|(?=$))/i);
      if (!m) break;
      rest = rest.slice(m[0].length);
      if (m[1]) { rest = m[1] + rest; break; }
    }
    if (rest === '' ) return '#page';
    if (rest === x) return '#page ' + x;       // 没匹配到 body 层级，直接加前缀
    if (/^[>+~]/.test(rest)) return '#page ' + rest;
    return '#page ' + rest;
  }
  function byTag(node, name) {
    var a = node.getElementsByTagNameNS ? node.getElementsByTagNameNS('*', name) : null;
    if (a && a.length) return a;
    return node.getElementsByTagName(name);
  }
  function parseNavXhtml(txt, path2ch, base) {
    var doc = new DOMParser().parseFromString(txt, 'text/html'), out = [], nav = null;
    try { nav = doc.querySelector('nav[epub\\:type="toc"]'); } catch (e) {}
    nav = nav || doc.querySelector('nav') || doc.body;
    var lis = nav.querySelectorAll('li'), i;
    for (i = 0; i < lis.length; i++) {
      var a = lis[i].querySelector('a');
      if (!a) continue;
      var href = a.getAttribute('href') || '', lab = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!lab) continue;
      var anchor = href.split('#')[1] || '', p = Z.resolvePath(pathDir(base), href);
      var lvl = 0, q = lis[i].parentElement;
      while (q && q !== nav) { if (q.tagName === 'OL' || q.tagName === 'UL') lvl++; q = q.parentElement; }
      out.push({ label: lab, ch: path2ch[p] === undefined ? -1 : path2ch[p], level: Math.max(0, lvl - 1), anchor: anchor });
    }
    return out;
  }
  function parseNcx(txt, path2ch, base) {
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    var pts = byTag(doc, 'navPoint'), out = [], i;
    if (!pts.length) { doc = new DOMParser().parseFromString(txt, 'text/html'); pts = byTag(doc, 'navPoint'); }
    for (i = 0; i < pts.length; i++) {
      var np = pts[i], lab = '', src = '';
      var nl = byTag(np, 'navLabel')[0]; if (nl) lab = (nl.textContent || '').trim().replace(/\s+/g, ' ');
      var ct = byTag(np, 'content')[0]; if (ct) src = ct.getAttribute('src') || '';
      if (!lab) continue;
      var lvl = 0, q = np.parentNode;
      while (q) { if ((q.nodeName || '').toLowerCase().indexOf('navpoint') >= 0) { lvl++; q = q.parentNode; } else break; }
      var p = Z.resolvePath(pathDir(base), src);
      out.push({ label: lab, ch: path2ch[p] === undefined ? -1 : path2ch[p], level: lvl, anchor: src.split('#')[1] || '' });
    }
    return out;
  }

  function buildEpub(buf, name) {
    var u8 = new Uint8Array(buf), zip = Z.makeZip(u8);
    ACTIVE_ZIP = zip;
    var cont = zip.text('META-INF/container.xml') || '';
    var mm = cont.match(/full-path\s*=\s*["']([^"']+)["']/i);
    var opfPath = mm ? mm[1] : (zip.names.filter(function (n) { return /\.opf$/i.test(n); })[0]);
    var real = opfPath && zip.find(opfPath);
    if (!real) throw new Error(T('找不到 OPF 描述文件，可能不是标准 EPUB'));
    var opf = zip.text(real), doc = new DOMParser().parseFromString(opf, 'application/xml');
    var items = els(doc, 'item'), refs = els(doc, 'itemref'), i;
    var id2 = {}, props = {}, ncxPath = null, navPath = null, coverPath = null;
    if (!items.length) { // 容错：XML 解析失败时退正则
      var re = /<item\b([^>]*)>/gi, m2;
      while ((m2 = re.exec(opf))) {
        var at = {}; m2[1].replace(/([:\w-]+)\s*=\s*["']([^"']*)["']/g, function (a, k, v) { at[k] = v; return a; });
        if (at.id) id2[at.id] = { href: at.href || '', type: at['media-type'] || '', prop: at.properties || '' };
      }
    } else {
      for (i = 0; i < items.length; i++) {
        var it = items[i], id = it.getAttribute('id');
        if (!id) continue;
        id2[id] = { href: it.getAttribute('href') || '', type: it.getAttribute('media-type') || '', prop: it.getAttribute('properties') || '' };
      }
    }
    var spine = [], hrefs = [];
    if (!refs.length) {
      var re2 = /<itemref\b([^>]*)>/gi, m3;
      while ((m3 = re2.exec(opf))) { var idr = (m3[1].match(/idref\s*=\s*["']([^"']+)["']/i) || [])[1]; if (idr && id2[idr]) spine.push(idr); }
    } else {
      for (i = 0; i < refs.length; i++) { var ir = refs[i].getAttribute('idref'); if (ir && id2[ir]) spine.push(ir); }
    }
    var opfDir = pathDir(real);
    spine.forEach(function (id) { hrefs.push(zip.find(Z.resolvePath(opfDir, id2[id].href)) || Z.resolvePath(opfDir, id2[id].href)); });
    var path2ch = {}; hrefs.forEach(function (p, i) { if (path2ch[p] === undefined) path2ch[p] = i; });
    Object.keys(id2).forEach(function (id) {
      var it = id2[id], p = zip.find(Z.resolvePath(opfDir, it.href)) || Z.resolvePath(opfDir, it.href);
      if (/ncx$/.test(it.type) || /\.ncx$/i.test(it.href)) ncxPath = p;
      if (/nav/.test(it.prop)) navPath = p;
      if (/cover-image/.test(it.prop) || /^cover\.(jpg|jpeg|png|webp|gif)$/i.test((it.href || '').split('/').pop() || '')) {
        if (!coverPath) coverPath = p;
      }
    });
    if (!ncxPath) { var n = zip.names.filter(function (x) { return /\.ncx$/i.test(x); })[0]; if (n) ncxPath = zip.find(n); }
    if (!navPath) { var n2 = zip.names.filter(function (x) { return /nav\.xhtml$/i.test(x); })[0]; if (n2) navPath = zip.find(n2); }
    var coverMeta = (opf.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    if (coverMeta && id2[coverMeta]) coverPath = zip.find(Z.resolvePath(opfDir, id2[coverMeta].href)) || coverPath;
    // 目录
    var toc = [];
    if (navPath) { var nt = zip.text(navPath); if (nt) toc = parseNavXhtml(nt, path2ch, navPath); }
    if (!toc.length && ncxPath) { var ct = zip.text(ncxPath); if (ct) toc = parseNcx(ct, path2ch, ncxPath); }
    toc = toc.filter(function (t) { return t.ch >= 0; });
    // 标题：目录优先，缺省用序号
    var titleMap = {};
    toc.forEach(function (t) { if (titleMap[t.ch] === undefined) titleMap[t.ch] = t.label; });
    var titles = hrefs.map(function (p, i) {
      if (titleMap[i]) return titleMap[i];
      var base = (p.split('/').pop() || '').replace(/\.[^.]+$/, '');
      return /^(chapter|part|section|page|text|ch)?[\d_-]+$/i.test(base) ? T('第 {n} 节', { n: i + 1 }) : (base || T('第 {n} 节', { n: i + 1 }));
    });
    var title = xmlText(doc, 'title') || name, author = xmlText(doc, 'creator') || '';
    var css = '';
    Object.keys(id2).forEach(function (id) {
      if (/css$/.test(id2[id].type) || /\.css$/i.test(id2[id].href)) {
        var p = zip.find(Z.resolvePath(opfDir, id2[id].href));
        var t = p && zip.text(p); if (t) css += rewriteCss(t, p, zip) + '\n';
      }
    });
    return {
      kind: 'epub', zip: zip, css: css, count: hrefs.length, titles: titles, toc: toc,
      title: title, author: author, coverPath: coverPath, cover: null, opfDir: opfDir,
      _hrefs: hrefs, _p2c: path2ch, spineHrefs: hrefs, path2ch: path2ch,
      chapterHtml: function (idx) { return epubChapter(idx); },
      chapterText: function (idx) { return stripTags(epubChapter(idx)); }
    };
  }

  function stripTags(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    d.querySelectorAll('style,script').forEach(function (e) { e.remove(); });
    return (d.textContent || '').replace(/\s+/g, ' ');
  }
  /* 把 EPUB 正文重建为扁平的朗读段落：兼容 <p> 分段、<div> 嵌套、纯 <br> 分段的老书，
     保留内联标签（链接/加粗/图片），避免整章落成一个超大朗读单元。 */
  function buildParagraphs(body) {
    var out = [], cur = '', head = false;
    var BLOCK = /^(p|div|h[1-6]|li|blockquote|pre|section|article|tr|td|ul|ol|table|dl|dt|dd|center|address)$/;
    function flush() {
      var plain = cur.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').trim();
      var hasMedia = /<(img|image)\b/i.test(cur);   // 封面 / 插图页没有文字，也要保留
      if (plain || hasMedia) out.push('<p class="rdp' + (head ? ' rdh' : '') + '">' + cur + '</p>');
      cur = ''; head = false;
    }
    function walk(node) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { cur += esc(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toLowerCase();
        if (/^(script|style|noscript|br)$/.test(tag)) { if (tag === 'br') flush(); return; }
        if (BLOCK.test(tag)) {
          flush(); head = /^h[1-6]$/.test(tag);
          walk(n); flush(); return;
        }
        cur += n.outerHTML;   // 内联元素已清理过危险属性，可直接保留
      });
    }
    walk(body); flush();
    return out.join('\n');
  }
  function epubChapter(idx) {
    var href = BK.spineHrefs[idx];
    var raw = BK.zip.read(href);
    if (!raw) return '<p class="rdp">' + T('（本章文件缺失）') + '</p>';
    var txt = Z.decodeAny(raw).text, dir = pathDir(href);
    var d = new DOMParser().parseFromString(txt, 'text/html'), body = d.body;
    var css = [BK.css || ''];
    body.querySelectorAll('link[rel~="stylesheet"]').forEach(function (l) {
      var p = Z.resolvePath(dir, l.getAttribute('href') || ''), t = BK.zip.text(p);
      if (t) css.push(rewriteCss(t, p, BK.zip));
      l.remove();
    });
    body.querySelectorAll('style').forEach(function (s) { css.push(rewriteCss(s.textContent || '', href, BK.zip)); s.remove(); });
    body.querySelectorAll('script,iframe,object,embed,form,input,button,select,textarea,audio,video,meta,base,link').forEach(function (e) { e.remove(); });
    body.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (n.indexOf('on') === 0 || n === 'srcdoc' || /^\s*(javascript|vbscript):/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    body.querySelectorAll('img').forEach(function (im) {
      var src = im.getAttribute('src') || im.getAttribute('data-src') || '';
      if (!src) return;
      var u = assetURL(Z.resolvePath(dir, src), BK.zip);
      if (u) im.setAttribute('src', u); else im.removeAttribute('src');
      im.removeAttribute('srcset');
    });
    body.querySelectorAll('image').forEach(function (im) {
      var h = im.getAttribute('xlink:href') || im.getAttribute('href') || im.getAttribute('src') || '';
      if (!h) return;
      var u = assetURL(Z.resolvePath(dir, h), BK.zip);
      if (u) { im.setAttribute('xlink:href', u); im.setAttribute('href', u); }
    });
    body.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      if (/^(https?:|mailto:)/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); return; }
      var anchor = h.split('#')[1] || '', p = Z.resolvePath(dir, h), ch = BK.path2ch[p];
      if (ch !== undefined) { a.setAttribute('href', 'javascript:void(0)'); a.setAttribute('data-ch', ch); a.setAttribute('data-anchor', anchor); }
      else a.removeAttribute('href');
    });
    var inner = buildParagraphs(body);
    return '<style>' + css.join('\n') + '</style>' + inner;
  }

  /* PDF：文字层由 pdfbook.js 抽出来（内置 PDF.js），抽完就是一本纯文本书。
     抽一次要按页跑，几百页的册子要几十秒，所以抽出来的正文随书存在本机
     （blobs.text），重开同一本书直接还原章节，不再解一遍。 */
  var PDFPROG = { fn: null };
  function pdfWrap(r, name) {
    var titles = r.titles || [];
    return {
      kind: 'pdf', enc: '', count: titles.length, titles: titles, cover: null,
      title: name, author: '', pdfText: r.text || '', pdfPages: r.pages || 0, pdfEn: !!r.en,
      toc: titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; }),
      chapterHtml: function (i) {
        return (r.body[i] || []).map(function (l) { return '<p class="rdp">' + esc(l) + '</p>'; }).join('\n');
      },
      chapterText: function (i) { return (r.body[i] || []).join('\n'); }
    };
  }

  /* 图片层 PDF：没有文字层，一页就是一屏图。一本 = 页数章，每章画一张 canvas。
     翻页 / 进度 / 目录 / 书签都用现成那一套，只是不能朗读和划词。 */
  function pdfPictureBook(name, pages, why) {
    var n = Math.max(1, pages | 0);
    var titles = [];
    for (var k = 0; k < n; k++) titles.push(T('第 {n} 页', { n: k + 1 }));
    return {
      kind: 'pdf', picture: true, pdfWhy: why || 'scan', enc: '', count: n, titles: titles, cover: null,
      title: name, author: '', pdfText: '', pdfPages: n, pdfEn: false,
      toc: titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; }),
      chapterHtml: function (i) {
        return '<div class="pdfpg" data-pg="' + (i + 1) + '"><div class="pdfld">' +
          esc(T('正在渲染第 {n} 页…', { n: i + 1 })) + '</div></div>';
      },
      chapterText: function () { return ''; }
    };
  }

  function buildPdf(buf, name, onProgress) {
    if (!window.PdfBook) return Promise.reject(new Error(T('这个包里没有 PDF 组件，请用完整版')));
    return PdfBook.build(buf, name, { T: T, isTitle: isChapterTitle, onProgress: onProgress })
      .then(function (r) { return r.picture ? pdfPictureBook(name, r.pages, r.why) : pdfWrap(r, name); });
  }
  function pdfFromText(text, name) {
    if (!window.PdfBook) return buildTxt(new ArrayBuffer(0), name);
    return pdfWrap(PdfBook.fromText(text, name, { T: T, isTitle: isChapterTitle }), name);
  }
  /* meta：从书架重开时带过来。picture=1 说明这本上次就判定成扫描件了，
     不必再花几十秒把文字层重抽一遍（抽完还是空的）。 */
  /* DOCX / MOBI / AZW3：先抠成纯文本，再交给 TXT 那套切章。
     解析是同步的（DOMParser / LZ77 解压），开一个宏任务让「正在导入」先画出来。 */
  function buildFromFmt(buf, name, ext) {
    return new Promise(function (res, rej) {
      setTimeout(function () {
        try {
          if (!window.DocFmt) throw new Error(T('这个包里没有文档解析组件，请用完整版打开'));
          var r = (ext === 'docx') ? DocFmt.docx(buf, { Z: Z }) : DocFmt.mobi(buf, { Z: Z });
          var b = buildTxtText(r.text, name);
          b.kind = r.kind;
          b.fmtText = r.text;        // 存进本机，下次打开不用再解一遍
          if (r.title) b.title = String(r.title).slice(0, 120);
          res(b);
        } catch (e) { rej(e); }
      }, 30);
    });
  }

  function parseBook(buf, name, ext, cached, meta) {
    var b;
    if (ext === 'pdf') {
      if (meta && meta.picture) b = pdfPictureBook(name, meta.pages || 1, meta.pdfWhy);
      else b = cached ? pdfFromText(cached, name) : buildPdf(buf, name, PDFPROG.fn);
    }
    else if (ext === 'docx' || ext === 'mobi' || ext === 'azw3') {
      b = cached ? buildTxtText(cached, name) : buildFromFmt(buf, name, ext);
    }
    else if (ext === 'doc') {
      throw new Error(T('老版 .doc（Word 97-2003）是二进制格式，读不了。用 Word / WPS 另存为 .docx 就行，排版也更稳'));
    }
    else if (ext === 'epub') {
      /* EPUB 和 DOCX 都是一层 ZIP：后缀写错、或者手机上传来的名字被改过，
         这里兜一下——解不开 EPUB 就看看里面有没有 word/document.xml。 */
      try { b = buildEpub(buf, name); }
      catch (e) {
        if (!window.DocFmt) throw e;
        b = buildFromFmt(buf, name, 'docx');
      }
    }
    else b = buildTxt(buf, name);
    return Promise.resolve(b)
      .then(function (bk) { bk.buf = buf; return bk; })   // 图片页要拿原 PDF 重新渲染
      .then(makeCover);
  }
  function makeCover(b) {
    /* 图片层 PDF 没有封面图，就把第一页缩小当封面——书架上一排白框比什么都难看 */
    if (b.picture) return new Promise(function (res) {
      var done = false;
      function fin() { if (!done) { done = true; res(b); } }
      setTimeout(fin, 6000);
      try {
        PdfBook.renderPage(b.buf, 1, document.createElement('canvas'), { width: 300, dpr: 1 })
          .then(function (r) {
            var src = r && r.canvas;
            if (!src) return;
            var c = document.createElement('canvas'), W = 120, H = 160;
            c.width = W; c.height = H;
            var g = c.getContext('2d'), k = Math.min(W / src.width, H / src.height);
            g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
            g.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2,
              src.width * k, src.height * k);
            b.cover = c.toDataURL('image/jpeg', 0.72);
          }).catch(function () { }).then(fin);
      } catch (e) { fin(); }
    });
    return new Promise(function (res) {
      var url = assetURL(b.coverPath, b.zip);
      if (!url) return res(b);
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas'), W = 120, H = 160;
          c.width = W; c.height = H;
          var g = c.getContext('2d'), r = Math.max(W / im.width, H / im.height);
          g.drawImage(im, (W - im.width * r) / 2, (H - im.height * r) / 2, im.width * r, im.height * r);
          b.cover = c.toDataURL('image/jpeg', 0.72);
        } catch (e) {}
        res(b);
      };
      im.onerror = function () { res(b); };
      im.src = url;
      setTimeout(function () { res(b); }, 2500);
    });
  }

  /* ---------------- 阅读统计（本机） ---------------- */
  var STATS = { days: {}, total: 0 };
  function loadStats() {
    try { var o = JSON.parse(localStorage.getItem('MOYIN_STATS') || '{}'); if (o && typeof o === 'object') STATS = o; } catch (e) { }
    STATS.days = STATS.days || {}; STATS.total = Number(STATS.total) || 0;
  }
  function saveStats() { try { localStorage.setItem('MOYIN_STATS', JSON.stringify(STATS)); } catch (e) { } }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function statAdd(sec) {
    if (!sec || sec <= 0) return;
    STATS.total += sec;
    var k = dayKey(); STATS.days[k] = (STATS.days[k] || 0) + sec;
    saveStats();
  }
  function statStreak() {
    var n = 0, d = new Date();
    // 今天还没读时，连击从昨天算起，不把「今天没读」当成断签
    if (!STATS.days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (STATS.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function statDays() { return Object.keys(STATS.days).length; }
  /* 时长文案：小于 1 分钟说秒，1 小时内说分，超过说时分 */
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return T('{s} 秒', { s: sec });
    var m = Math.round(sec / 60);
    if (m < 60) return T('{m} 分', { m: m });
    var h = Math.floor(m / 60), mm = m % 60;
    return mm ? T('小时 {h} 分', { h: h, m: mm }) : h + ' ' + T('小时');
  }
  /* 单次阅读计时：打开书开始，关书 / 切后台 / 关页面结算 */
  var RT = { t0: 0, id: null };
  function rtStart(id) { rtFlush(); RT.t0 = Date.now(); RT.id = id; }
  function rtFlush() {
    if (!RT.t0 || !RT.id) { RT.t0 = 0; RT.id = null; return; }
    var sec = Math.round((Date.now() - RT.t0) / 1000), id = RT.id;
    RT.t0 = 0; RT.id = null;
    if (sec < 3) return;                       // 翻两下就走的不记账
    if (sec > 3 * 3600) sec = 3 * 3600;        // 挂机保护：单次最多记 3 小时
    statAdd(sec);
    var b = bookOf(id);
    if (b) {
      b.rt = (b.rt || 0) + sec;
      b.sessions = (b.sessions || 0) + 1;
      b.first = b.first || Date.now();
      dbPut('books', b).catch(function () { });
    }
  }

  /* ---------------- 书架 ---------------- */
  function bookOf(id) { return BOOKS.filter(function (b) { return b.id === id; })[0]; }
  function shelves() { if (!Array.isArray(CFG.shelves)) CFG.shelves = []; return CFG.shelves; }
  function hlList(b) { return (b && b.hl) || []; }
  function noteCount(b) { return hlList(b).filter(function (h) { return h.note; }).length; }
  function sortBooks() {
    var f = ({ last: function (a, b) { return b.last - a.last; },
      name: function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); },
      added: function (a, b) { return b.added - a.added; },
      progress: function (a, b) { return b.progress - a.progress; } })[CFG.sort] || function (a, b) { return b.last - a.last; };
    // 收藏的书永远排在前面，内部再按当前排序规则
    BOOKS.sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || f(a, b); });
  }
  function shelfView() { return CFG.shelfView || 'all'; }
  function matchShelf(b, v) {
    if (v === 'fav') return !!b.fav;
    if (v === 'none') return !b.group || shelves().indexOf(b.group) < 0;
    if (v.indexOf('g:') === 0) return b.group === v.slice(2);
    return true;
  }
  function renderShelfBar() {
    var box = $('shelfBar'); if (!box) return;
    var v = shelfView(), items = [];
    items.push({ k: 'all', label: T('全部书籍'), n: BOOKS.length });
    items.push({ k: 'fav', label: T('★ 收藏'), n: BOOKS.filter(function (b) { return b.fav; }).length });
    shelves().forEach(function (nm) {
      items.push({ k: 'g:' + nm, label: nm, n: BOOKS.filter(function (b) { return b.group === nm; }).length });
    });
    var noneN = BOOKS.filter(function (b) { return !b.group || shelves().indexOf(b.group) < 0; }).length;
    if (shelves().length && noneN) items.push({ k: 'none', label: T('未分组'), n: noneN });
    box.innerHTML = items.map(function (x) {
      return '<button class="chip' + (v === x.k ? ' on' : '') + '" data-sv="' + esc(x.k) + '">' +
        esc(x.label) + '<span class="n">' + x.n + '</span></button>';
    }).join('') + '<button class="chip add" data-sv="__new">＋ ' + esc(T('新建书架')) + '</button>';
  }
  function shelfList() {
    var q = ($('libSearch').value || '').trim().toLowerCase(), v = shelfView();
    return BOOKS.filter(function (b) {
      if (!matchShelf(b, v)) return false;
      return !q || (b.name || '').toLowerCase().indexOf(q) >= 0 || (b.author || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderShelf() {
    sortBooks();
    renderShelfBar();
    var q = ($('libSearch').value || '').trim().toLowerCase(), box = $('shelf'), v = shelfView();
    var list = shelfList();
    box.innerHTML = list.map(function (b) {
      var cv = b.cover ? '<img src="' + b.cover + '" alt="">'
        : '<div class="ph">' + esc((b.name || T('书')).slice(0, 4)) + '</div>';
      var nc = noteCount(b);
      return '<div class="bk' + (SELS[b.id] ? ' sel' : '') + '" data-id="' + b.id + '">' +
        '<div class="cv">' + cv + (nc ? '<span class="kn">✎ ' + nc + '</span>' : '') + '</div>' +
        '<div class="chk">✓</div>' +
        '<button class="fav' + (b.fav ? ' on' : '') + '" data-fav="' + b.id + '" title="' +
        esc(b.fav ? T('取消收藏') : T('收藏')) + '">' + (b.fav ? '★' : '☆') + '</button>' +
        '<button class="more" data-more="' + b.id + '" title="' + esc(T('更多')) + '">⋯</button>' +
        '<div class="meta"><div class="nm">' + esc(b.name) + '</div>' +
        '<div class="sub"><span class="tag">' + esc(b.ext.toUpperCase()) + '</span>' + fmtSize(b.size) +
        (b.author ? ' · ' + esc(b.author.slice(0, 8)) : '') + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(100, b.progress || 0) + '%"></i></div>' +
        '<div class="sub">' + (b.progress > 0 ? T('读到 {p}%', { p: (b.progress).toFixed(1) }) : T('未读')) + ' · ' + fmtDate(b.last) + '</div>' +
        (b.lCh != null && b.lPi != null
          ? '<button class="resume" data-listen="' + b.id + '" title="' + esc(T('从上次听到的地方继续听')) + '">' +
            esc(T('▶ 续听 · 第 {n} 章', { n: (b.lCh | 0) + 1 })) + '</button>'
          : '') +
        '</div></div>';
    }).join('');
    $('emptyLib').style.display = BOOKS.length ? 'none' : '';
    $('libStat').textContent = T('书架 {n} 本', { n: BOOKS.length }) +
      (q || v !== 'all' ? T('（筛出 {n} 本）', { n: list.length }) : '');
    var st = $('libStats');
    if (st) {
      var bits = [];
      if (STATS.total >= 60) bits.push(T('累计阅读 {t}', { t: fmtDur(STATS.total) }));
      if (statDays()) bits.push(T('共 {n} 天，最长连续 {d} 天', { n: statDays(), d: statStreak() }));
      st.textContent = bits.join(' · ');
    }
    renderSelBar();
  }
  /* ------- 批量选择 ------- */
  var SELS = {};
  function selCount() { return Object.keys(SELS).filter(function (k) { return SELS[k]; }).length; }
  function enterSelMode(on) {
    document.body.classList.toggle('selmode', !!on);
    if (!on) SELS = {};
    $('selBar').hidden = !on;
    renderShelf();
  }
  function renderSelBar() {
    if (document.body.classList.contains('selmode')) $('selCount').textContent = T('已选 {n} 本', { n: selCount() });
  }
  function toggleSel(id) { SELS[id] = !SELS[id]; renderShelf(); }
  function askBatchMove() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    var opts = shelves().map(function (nm) { return '<option value="' + esc(nm) + '">' + esc(nm) + '</option>'; }).join('');
    showModal(T('移动到书架'),
      '<div class="row"><label>' + esc(T('移动到')) + '</label><select id="mvTo">' +
      '<option value="">' + esc(T('未分组')) + '</option>' + opts + '</select>' +
      '<input type="text" id="mvNew" placeholder="' + esc(T('或新建书架')) + '" style="width:150px"></div>',
      [{ label: T('取消') }, { label: T('确定'), cls: 'pri', fn: function () {
        var v = $('mvNew').value.trim() || $('mvTo').value;
        if (v && shelves().indexOf(v) < 0) { shelves().push(v); saveCfg(); }
        ids.forEach(function (id) { var b = bookOf(id); if (b) { b.group = v; dbPut('books', b).catch(function () { }); } });
        closeModal(); exitSel(); toast(T('已移动 {n} 本', { n: ids.length }));
      } }]);
  }
  function batchFav() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    ids.forEach(function (id) { var b = bookOf(id); if (b) { b.fav = 1; dbPut('books', b).catch(function () { }); } });
    toast(T('已收藏 {n} 本', { n: ids.length })); renderShelf();
  }
  function batchDel() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    confirmModal(T('把选中的 {n} 本从书架移除？原文件不会从电脑删除。', { n: ids.length }), async function () {
      for (var i = 0; i < ids.length; i++) { await dbDel('books', ids[i]); await dbDel('blobs', ids[i]); }
      BOOKS = BOOKS.filter(function (b) { return ids.indexOf(b.id) < 0; });
      exitSel();
    });
  }
  function exitSel() { enterSelMode(false); }

  /* ------- 单本菜单：收藏 / 编辑信息 / 移动 / 移除 ------- */
  function openBookMenu(id) {
    var b = bookOf(id); if (!b) return;
    var opts = '<option value="">' + esc(T('未分组')) + '</option>' +
      shelves().map(function (nm) { return '<option value="' + esc(nm) + '"' + (b.group === nm ? ' selected' : '') + '>' + esc(nm) + '</option>'; }).join('') +
      (b.group && shelves().indexOf(b.group) < 0 ? '<option value="' + esc(b.group) + '" selected>' + esc(b.group) + '</option>' : '');
    showModal(b.name,
      '<div class="row"><label>' + esc(T('书名')) + '</label><input type="text" id="bkName" value="' + esc(b.name) + '" style="flex:1"></div>' +
      '<div class="row"><label>' + esc(T('作者')) + '</label><input type="text" id="bkAuthor" value="' + esc(b.author || '') + '" style="flex:1"></div>' +
      '<div class="row"><label>' + esc(T('移动到')) + '</label><select id="bkGroup" style="flex:1">' + opts + '</select></div>' +
      '<div class="row"><label></label><div class="seg">' +
      '<button data-bkact="fav">' + esc(b.fav ? T('取消收藏') : T('收藏')) + '</button>' +
      '<button data-bkact="select">' + esc(T('批量管理')) + '</button>' +
      '<button data-bkact="del" class="danger">' + esc(T('从书架移除')) + '</button></div></div>' +
      '<p class="kv">' + esc(T('改名只影响书架显示，不会改动原文件。')) + '</p>',
      [{ label: T('取消') }, { label: T('保存'), cls: 'pri', fn: function () {
        var nm = $('bkName').value.trim(), au = $('bkAuthor').value.trim(), g = $('bkGroup').value;
        if (nm) b.name = nm;
        b.author = au; b.group = g;
        dbPut('books', b).catch(function () { }); closeModal(); renderShelf(); toast(T('已保存'));
      } }]);
    $('modalBody').onclick = function (e) {
      var a = e.target.closest('[data-bkact]'); if (!a) return;
      var act = a.getAttribute('data-bkact');
      if (act === 'fav') { b.fav = b.fav ? 0 : 1; dbPut('books', b).catch(function () { }); closeModal(); renderShelf(); }
      else if (act === 'select') {
        closeModal();
        if (!document.body.classList.contains('selmode')) enterSelMode(true);
        SELS[id] = true; renderShelf();
      } else if (act === 'del') {
        closeModal();
        confirmModal(T('把《{n}》从书架移除？原文件不会从电脑删除。', { n: b.name }), async function () {
          await dbDel('books', id); await dbDel('blobs', id);
          BOOKS = BOOKS.filter(function (x) { return x.id !== id; }); renderShelf(); toast(T('已移除'));
        });
      }
    };
  }
  function toggleFav(id) {
    var b = bookOf(id); if (!b) return;
    b.fav = b.fav ? 0 : 1;
    dbPut('books', b).catch(function () { });
    renderShelf();
    toast(b.fav ? T('已收藏') : T('已取消收藏'), 1500);
  }

  /* ------- 书架的增删改 ------- */
  function showShelves() {
    var list = shelves();
    var rows = list.map(function (nm, i) {
      var n = BOOKS.filter(function (b) { return b.group === nm; }).length;
      return '<div class="row"><label style="min-width:0;flex:1">' + esc(nm) + '<span class="kv"> · ' + T('共 {n} 本', { n: n }) + '</span></label>' +
        '<button data-sh="ren" data-i="' + i + '">' + esc(T('重命名')) + '</button>' +
        '<button data-sh="del" data-i="' + i + '" class="danger">' + esc(T('解散书架')) + '</button></div>';
    }).join('') || '<p class="kv">' + esc(T('还没有自定义书架。新建一个，把书分类放进去。')) + '</p>';
    showModal(T('管理书架'),
      '<div class="row"><label>' + esc(T('新建书架')) + '</label>' +
      '<input type="text" id="shNew" placeholder="' + esc(T('书架名')) + '" style="flex:1;min-width:120px">' +
      '<button class="pri" data-sh="add">' + esc(T('新建')) + '</button></div>' + rows +
      '<p class="kv">' + esc(T('解散书架不会删书，里面的书会回到「未分组」。')) + '</p>',
      [{ label: T('关闭') }]);
    $('modalBody').onclick = function (e) {
      var b = e.target.closest('[data-sh]'); if (!b) return;
      var act = b.getAttribute('data-sh'), i = Number(b.getAttribute('data-i'));
      if (act === 'add') {
        var nm = ($('shNew').value || '').trim();
        if (!nm) { toast(T('请先填写书架名')); return; }
        if (shelves().indexOf(nm) >= 0) { toast(T('已经有同名书架')); return; }
        shelves().push(nm); saveCfg(); showShelves(); renderShelf(); toast(T('书架已建好'));
      } else if (act === 'ren') {
        var old = shelves()[i];
        showModal(T('重命名'), '<input type="text" id="shRen" value="' + esc(old) + '" style="width:100%">',
          [{ label: T('取消') }, { label: T('保存'), cls: 'pri', fn: function () {
            var nm2 = ($('shRen').value || '').trim();
            if (!nm2 || nm2 === old) { closeModal(); return; }
            shelves()[i] = nm2; saveCfg();
            BOOKS.forEach(function (x) { if (x.group === old) { x.group = nm2; dbPut('books', x).catch(function () { }); } });
            if (shelfView() === 'g:' + old) CFG.shelfView = 'g:' + nm2;
            saveCfg(); closeModal(); renderShelf(); toast(T('书架已重命名'));
          } }]);
      } else if (act === 'del') {
        var nm3 = shelves()[i];
        confirmModal(T('解散书架「{n}」？书不会被删除。', { n: nm3 }), function () {
          shelves().splice(i, 1);
          BOOKS.forEach(function (x) { if (x.group === nm3) { x.group = ''; dbPut('books', x).catch(function () { }); } });
          if (shelfView() === 'g:' + nm3) CFG.shelfView = 'all';
          saveCfg(); closeModal(); renderShelf(); toast(T('已解散书架「{n}」，书都还在「全部书籍」里', { n: nm3 }), 3600);
        });
      }
    };
  }
  function readExt(name) {
    var e = (name.split('.').pop() || '').toLowerCase();
    if (e === 'epub') return 'epub';
    if (e === 'pdf') return 'pdf';
    if (e === 'txt' || e === 'text') return 'txt';
    if (e === 'docx') return 'docx';
    if (e === 'doc') return 'doc';                 // 老二进制 Word：只认得出来，读不了
    if (e === 'mobi' || e === 'prc') return 'mobi';
    if (e === 'azw3' || e === 'azw') return 'azw3';
    if (e === 'zip') return 'zip';                 // 压缩包：解开后逐本导入
    if (e === 'rar' || e === '7z') return 'pack';  // 认得出来，但解码器还没带
    return '';
  }
  /* 文件名里没有后缀时靠文件头认书。
     安卓有些文件管理器（小米、华为那几家）给 WebView 的显示名会丢掉扩展名，
     甚至只剩一串数字，于是 .epub 被判成「不支持」——用户的尖叫点就在这里：
     文件明明选进来了，却提示「跳过 1 本（重复或不支持）」。
     EPUB 本质是个 ZIP，开头一定是 PK；剩下能读出文本的按 TXT 处理。 */
  function sniffExt(buf) {
    if (!buf || !buf.byteLength) return '';
    var n = Math.min(buf.byteLength, 4096), h = new Uint8Array(buf, 0, n), i;
    if (n >= 4 && h[0] === 0x50 && h[1] === 0x4b) {                 // PK\x03\x04 / PK\x05\x06 / PK\x07\x08
      /* EPUB、DOCX、普通 ZIP 三者都是 PK 开头。以前一律当 EPUB，于是「一包 TXT」
         被丢进 EPUB 解析器，报「不是有效的 EPUB」；现在看目录表分：
         有 word/document.xml 是 DOCX，有 META-INF/container.xml 是 EPUB，其余是 ZIP。 */
      try {
        var zz = Z.makeZip(new Uint8Array(buf)), nm = zz.names || [];
        if (nm.some(function (x) { return /^word\/document\.xml$/i.test(x); })) return 'docx';
        if (nm.some(function (x) { return /^META-INF\/container\.xml$/i.test(x); })) return 'epub';
        return 'zip';
      } catch (e) { return 'epub'; }
    }
    /* 下面这些是「选得到但读不了」的格式。1.14.19 起文件列表不再按类型过滤，
       PDF / MOBI 也会出现在眼前；一律当 TXT 强行解码的话，会把二进制塞进书架、
       读出来全是乱码——所以认不出来的宁可跳过并说清原因。 */
    if (n >= 4 && h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46) return 'pdf';  // %PDF
    if (n >= 68) {                                                  // Kindle：偏移 60 处有 BOOKMOBI / TPZ
      var tag = '';
      for (i = 60; i < 68; i++) tag += String.fromCharCode(h[i]);
      if (tag === 'BOOKMOBI') return 'mobi';            // MOBI / AZW3 共用一个容器头
      if (tag.indexOf('TPZ') === 0) return '';          // TOPAZ：私有格式，读不了
    }
    if (n >= 2 && ((h[0] === 0xff && h[1] === 0xfe) || (h[0] === 0xfe && h[1] === 0xff))) return 'txt';  // UTF-16 BOM
    /* 剩下的按「像不像文本」判：前 4 KB 里出现 NUL、或成片控制字符，就不是文本。
       GBK / GB18030 / Big5 的高位字节不进这个判断，照样认成 TXT。 */
    var nul = 0, ctl = 0;
    for (i = 0; i < n; i++) {
      var c = h[i];
      if (c === 0) nul++;
      else if (c < 9 || (c > 13 && c < 32)) ctl++;
    }
    if (nul || ctl > n * 0.02) return '';
    return 'txt';
  }
  /* 扫描结果（原生选目录 / 网络位置）统一走这里：报数 → 确认 → 导入 */
  function applyScan(r) {
    if (!r || r.cancel) return;
    if (r.error) {
      showModal(T('没能读取这个文件夹'),
        '<p>' + esc(r.error) + '</p>' +
        '<p class="kv">' + esc(T('可以改用「导入书籍」，在文件管理器里多选几本一起导。')) + '</p>',
        [{ label: T('知道了') }]);
      return;
    }
    if (!r.files || !r.files.length) {
      toast(r.skipped ? T('这个文件夹里只找到 {k} 个很小的 txt，看着不像书，没有导入', { k: r.skipped })
                      : T('这个文件夹里没有找到 TXT / EPUB'), 4200);
      return;
    }
    var dn = (r.dir || '').split(/[\\/]/).filter(Boolean).pop() || r.dir;
    var msg = T('在「{d}」里找到 {n} 个 TXT / EPUB', { d: dn, n: r.files.length });
    if (r.skipped) msg += '，' + T('跳过 {k} 个太小的文件', { k: r.skipped });
    if (r.truncated) msg += '，' + T('超过上限，只取前 {n} 个', { n: r.files.length });
    confirmModal(msg + T('。开始导入？'), function () { importFiles(r.files); });
  }
  async function importFolder() {
    // 桌面版：用 Python 的原生「选择文件夹」，不走浏览器那个「选择要上传的文件夹」
    if (typeof window.__moyinPickDir === 'function') {
      var r;
      try {
        r = await window.__moyinPickDir();
      } catch (e) {
        showModal(T('打开文件夹失败'), '<p>' + esc(e.message || String(e)) + '</p>', [{ label: T('关闭') }]);
        return;
      }
      applyScan(r);
      return;
    }
    $('dirInput').click();
  }

  /* 网络位置：SMB 共享（\\主机\共享）、映射好的网盘、本机任意绝对路径。
     走的是系统自己的网络访问，凭据由 Windows 管——资源管理器里能打开就能读。 */
  function importNet() {
    var last = CFG.netPath || '';
    showModal(T('从网络位置导入'),
      '<p>' + esc(T('填一个文件夹路径，里面的 TXT / EPUB 会像本地文件一样导进来，不复制、不上传。')) + '</p>' +
      '<p><input id="netPath" type="text" spellcheck="false" autocomplete="off" ' +
      'style="width:100%;box-sizing:border-box" placeholder="\\\\192.168.1.10\\Books" value="' + (last ? esc(last) : '') + '"></p>' +
      '<p class="kv">' + esc(T('可以写：\\\\主机\\共享名\\子目录、映射到网络的盘符（Z:\\书）、或用 NAS 的 IP。')) + '<br>' +
      esc(T('首次访问需要账号密码：先在「资源管理器」里打开一次并勾记住，这里就能直接读。')) + '</p>' +
      '<p class="kv">' + esc(T('这次导入只读当前选中的目录；原文件仍在原处，删掉书架里的书不会影响它们。')) + '</p>',
      [
        { label: T('取消') },
        {
          label: T('连接并扫描'), cls: 'pri', fn: function () {
            var box = $('netPath');
            var p = (box && box.value || '').trim();
            if (!p) { toast(T('先填一个路径')); return; }
            CFG.netPath = p; saveCfg();
            closeModal();
            toast(T('正在扫描…'), 1200);
            window.__moyinScanDir(p).then(function (r) {
              applyScan(r);
            }).catch(function (e) {
              showModal(T('连不上这个位置'), '<p>' + esc(e.message || String(e)) + '</p>' +
                '<p class="kv">' + esc(T('确认共享已开启、本机已在资源管理器里成功打开过这个目录。')) + '</p>',
                [{ label: T('关闭') }]);
            });
          }
        }
      ]);
    setTimeout(function () { var b = $('netPath'); if (b) { b.focus(); b.select(); } }, 60);
  }
  /* 一本从头到尾都是外文的书：手机版没有英文语音模型，读出来是一片安静。
     与其让用户以为是坏了，导入完就直说，并给出去哪台机器能读。 */
  function looksEn(b) {
    try {
      var t = (b.chapterText(0) || '').slice(0, 3000);
      var lat = (t.match(/[A-Za-z]/g) || []).length, han = (t.match(/[\u4e00-\u9fff]/g) || []).length;
      return lat > 300 && lat > han * 3;
    } catch (e) { return false; }
  }
  /* ---------------- 压缩包：把 ZIP 当书箱 ----------------
     网上下来的 txt 合集、资料包多半是 zip，一本本拖出来太笨。这里只解不写：
     读出目录表，挑出能读的书籍文件，逐个走正常导入流程（章节、朗读、笔记全一样）。
     不做的事：解压到磁盘（不碰用户目录）、解带密码的包（明说读不了）。
     RAR / 7Z 是另外两套解码器，没装就直说「先解压再导入」，不假装支持。 */
  var ZIP_IN = /\.(txt|text|epub|pdf|docx|mobi|prc|azw3|azw)$/i;
  var ZIP_MAX_ONE = 300 * 1048576;     // 单个文件上限 300 MB
  var ZIP_MAX_N = 300;                 // 一次最多解出这么多本，防止一个几百本的合集把界面顶死
  function zipBooks(buf, base) {
    if (!Z || !Z.makeZip) throw new Error('ZIP 组件没加载');
    var zip = Z.makeZip(new Uint8Array(buf));
    var names = zip.names || [], out = [], skipped = 0, i;
    out.skipped = 0;
    for (i = 0; i < names.length && out.length < ZIP_MAX_N; i++) {
      var n = names[i];
      if (/\/$/.test(n)) continue;                                  // 目录项
      /* 压缩包里常见的垃圾：Mac 的资源叉、系统缩略图、隐藏文件 */
      if (/(^|\/)(__MACOSX|\.git|\.Trashes?|\.Spotlight-V100)(\/|$)/i.test(n)) continue;
      var bn = n.split('/').pop();
      if (!bn || bn.charAt(0) === '.' || bn.charAt(0) === '~') continue;
      if (/^(Thumbs\.db|desktop\.ini)$/i.test(bn)) continue;
      if (!ZIP_IN.test(bn)) { skipped++; continue; }
      var f = zip.files[n];
      if (f && f.usize > ZIP_MAX_ONE) { skipped++; continue; }
      var b = null;
      try { b = zip.read(n); } catch (e) { skipped++; continue; }
      if (!b || !b.length) { skipped++; continue; }
      /* 必须拷成独立的 ArrayBuffer：EPUB/PDF 解析会把 buffer transfer 给 worker，
         留在原 zip 上的视图被 detach 之后就取不到字节了 */
      var ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      (function (name, arr) {
        out.push({ name: name, size: arr.byteLength, arrayBuffer: function () { return Promise.resolve(arr); } });
      })(bn, ab);
    }
    out.skipped = skipped;
    out.base = base;
    return out;
  }
  async function importFiles(files, quiet) {
    /* dropN：认不出的文件（MOBI、图片、压缩包……）。这类不报错、不进「跳过」清单——
       手机的文件列表为了让 epub 能显示，本来就不按类型过滤，用户顺手点到别的文件
       是常事。只有一份都没导进来时，才轻描淡写说一句。 */
    var okN = 0, skipN = 0, dropN = 0, errs = [], total = files.length, skipped = [], enBooks = [], pics = [], zips = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], ext = readExt(f.name);
      var bname = f.name.replace(/\.[^.]+$/, '');
      /* 同机重复导入就跳过。但「同步来的幽灵条目」（只有进度没有文件，noFile=1）
         不算已有——那本书实际上还没进来，得让用户导进去才能读。 */
      if (ext && BOOKS.some(function (b) { return b.name === bname && b.size === f.size && !b.noFile; })) {
        skipN++; skipped.push(bname + T('（书架已有）')); continue;
      }
      try {
        if (total > 3) toast(T('导入中… {a}/{b}', { a: i + 1, b: total }), 1500);
        var buf = await f.arrayBuffer();
        /* 指纹必须在 parseBook 之前算：PDF.js 会把 buffer transfer 给 worker，算晚了这份就空了 */
        var bkey = bookKey(buf, bname, f.size);
        if (!ext) ext = sniffExt(buf);        // 名字没后缀也认：EPUB 是 ZIP，PDF 是 %PDF
        if (!ext) { dropN++; continue; }      // MOBI 之类：静默略过
        /* 压缩包：解开后逐本递归导入，统计汇总到这一层 */
        if (ext === 'zip') {
          var inner;
          try { inner = zipBooks(buf, bname); }
          catch (e) { errs.push(f.name + '：' + e.message); continue; }
          if (!inner.length) {
            errs.push(f.name + '：' + T('这个压缩包里没有能读的书（TXT / EPUB / PDF / DOCX / MOBI / AZW3）'));
            continue;
          }
          if (total > 3) toast(T('正在解压《{n}》：{a} 本', { n: bname, a: inner.length }), 1600);
          var sub = await importFiles(inner, true);
          okN += sub.okN; skipN += sub.skipN;
          errs = errs.concat(sub.errs);
          enBooks = enBooks.concat(sub.enBooks); pics = pics.concat(sub.pics);
          zips.push({ n: bname, c: sub.okN, s: inner.skipped });
          continue;
        }
        if (ext === 'pack') {
          errs.push(f.name + '：' + T('RAR / 7Z 现在还不支持，请先解压，再导入里面的书'));
          continue;
        }
        /* PDF 要一页一页抽字，慢到能被当成卡死：给它一条页码进度 */
        PDFPROG.fn = ext === 'pdf' ? function (pg, all) {
          if (pg % 4 === 1 || pg === all) toast(T('正在读 PDF：{a}/{b} 页…', { a: pg, b: all }), 1400);
        } : null;
        try {
          var b = await parseBook(buf, bname, ext);
        } finally { PDFPROG.fn = null; }
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf, text: b.pdfText || b.fmtText || '' });
        var meta = {
          id: id, key: bkey, name: bname, ext: ext, size: f.size,
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0,
          cover: b.cover || '', title: b.title, author: b.author || '', marks: [], hl: [],
          chapters: b.titles.slice(0, 1000), tocCount: b.toc.length, enc: b.enc || '',
          pages: b.pdfPages || 0, picture: b.picture ? 1 : 0, pdfWhy: b.pdfWhy || '',
          group: shelfView().indexOf('g:') === 0 ? shelfView().slice(2) : '',
          fav: 0, rt: 0, sessions: 0, first: 0
        };
        var adopted = adoptByKey(meta);   // 同一本书上次读到的位置，直接接上
        await dbPut('books', meta); BOOKS.push(meta); okN++;
        if (adopted) toast(T('《{n}》接上了上次的进度', { n: bname }), 2600);
        if (b.enc && b.enc !== 'UTF-8' && b.enc !== 'UTF-8 BOM') toast(T('《{n}》按 {e} 解码', { n: meta.name, e: b.enc }), 3200);
        if (looksEn(b) && !enLocal()) enBooks.push(bname);
        if (b.picture) pics.push({ n: bname, p: b.pdfPages || 0, w: b.pdfWhy });
      } catch (e) { errs.push(f.name + '：' + e.message); }
    }
    renderShelf();
    var stats = { okN: okN, skipN: skipN, errs: errs, enBooks: enBooks, pics: pics, zips: zips };
    /* 递归导入（压缩包里的书）不要每解一层就弹一次窗，统计交回上一层统一说 */
    if (quiet) return stats;
    var msg = T('已导入 {n} 本', { n: okN });
    if (zips.length) msg += ' · ' + T('从 {k} 个压缩包里解出', { k: zips.length });
    if (skipN) {
      msg += ' · ' + T('跳过 {n} 本：{list}', {
        n: skipN, list: skipped.slice(0, 3).join('、') + (skipped.length > 3 ? '…' : '')
      });
    }
    if (errs.length) msg += T('，{n} 本失败', { n: errs.length });
    if (okN || skipN || errs.length) toast(msg, 4200);
    else if (dropN) toast(T('这几本还读不了，先导入 TXT / EPUB / PDF / DOCX / MOBI / AZW3 吧'), 3600);
    if (enBooks.length) {
      showModal(T('这本是英文书'),
        '<p>' + esc(T('《{n}》整本都是英文，朗读时会自动换用英文语音。',
          { n: enBooks.slice(0, 2).join('》《') })) + '</p>' +
        '<p class="kv">' + esc(T('第一次念到英文时引擎要先把英文模型装进内存，会慢几秒；之后就是正常的。如果英文一直不出声，可以在设置里把「英文语音」关掉——关掉后英文按语速留白，中文照常念。')) + '</p>',
        [{ label: T('知道了') }]);
    }
    if (errs.length) {
      /* 一个压缩包里几十个坏文件时别把弹窗撑成一面墙 */
      var shown = errs.slice(0, 8);
      var more = errs.length > shown.length ? '<p class="kv">' + esc(T('还有 {n} 个同类问题，没有一一列出', { n: errs.length - shown.length })) + '</p>' : '';
      showModal(T('部分文件未能导入'), '<p>' + shown.map(esc).join('</p><p>') + '</p>' + more, [{ label: T('知道了') }]);
    }
    if (pics.length) {
      /* scanwm：每页有字，但全是同一句水印（盗版团伙留的「加微信」之类），
         不是正文。这种以前会被当成文字书打开，用户看到的是一页页水印。 */
      var wm = pics[0].w === 'scanwm';
      showModal(T('这本 PDF 是扫描件'),
        '<p>' + esc(T(wm
          ? '《{n}》有 {p} 页，每页都是一整张扫描图。文件里确实有一层文字，但只有一句水印（不是正文），所以按原图显示，翻页、目录、进度都正常。'
          : '《{n}》有 {p} 页，整页都是扫描出来的图片，没有文字层。现在按页渲染成图片给你看，翻页、目录、进度都正常。',
          { n: pics[0].n, p: pics[0].p })) + '</p>' +
        '<p class="kv">' + esc(T(wm
          ? '看不了的那部分：不能朗读、不能划词、不能做笔记——要听这本书，得先拿 OCR 工具把整本识别成文字再导入。'
          : '看不了的那部分：不能朗读，也不能划词、做笔记——机器不认识图片里的字。这一点主流阅读器也一样。')) + '</p>',
        [{ label: T('知道了') }]);
    }
    return stats;
  }

  /* ---------------- 阅读 ---------------- */
  function chapterTitle(i) { return (BK.titles && BK.titles[i]) || T('第 {n} 节', { n: i + 1 }); }
  function chapterCount() { return BK ? BK.count : 0; }
  function showView(v) {
    $('viewLib').classList.toggle('on', v === 'lib');
    $('viewRead').classList.toggle('on', v === 'read');
    if (v === 'lib') { autoStop(true); hideRest(); clkStop(); renderShelf(); }
    else { clkStart(); pgAfterLayout(60); }
    applyImm();
  }
  async function openBook(id) {
    var rec = await dbGet('blobs', id);
    if (!rec) {
      /* 两种来路：真丢了；或者是从网盘同步来的「有进度没文件」。后者导入原文件就自动接上。 */
      toast(T('这本书的文件还不在本机：导入原文件后会从上次读到的位置接着读'), 4200);
      return;
    }
    var meta = BOOKS.filter(function (b) { return b.id === id; })[0] || await dbGet('books', id);
    stopSpeak(true);
    autoStop(true);
    resetCast();
    clearAssets();
    /* 上一本 PDF 的解析结果放掉再用新的：扫描件一本就几十 MB */
    try { if (window.PdfBook && PdfBook.closeDoc) PdfBook.closeDoc(); } catch (e) { }
    try {
      /* 从备份还原的 PDF 没有缓存正文，这里补抽一次，抽完顺手存回去。
         图片层 PDF 例外：它本来就没有正文，抽也抽不出东西。 */
      if (meta.ext === 'pdf' && !rec.text && !meta.picture) {
        PDFPROG.fn = function (pg, all) {
          if (pg % 4 === 1 || pg === all) toast(T('正在读 PDF：{a}/{b} 页…', { a: pg, b: all }), 1400);
        };
      }
      BK = await parseBook(rec.buf, meta.name, meta.ext, rec.text, meta);
      PDFPROG.fn = null;
      if (meta.ext === 'pdf' && !rec.text && BK.pdfText) {
        rec.text = BK.pdfText;
        dbPut('blobs', rec).catch(function () { });
      }
    } catch (e) { PDFPROG.fn = null; toast(T('打开失败：') + e.message, 4000); return; }
    BK.id = id; BK.meta = meta;
    loadCast(meta);                    // 上次听这本书时定下的人物声线，原样接回来
    if (!Array.isArray(meta.hl)) meta.hl = [];
    if (!meta.first) meta.first = Date.now();
    meta.last = Date.now();
    $('readTitle').textContent = meta.name;
    $('readTitle').title = meta.name + (meta.author ? ' · ' + meta.author : '');
    document.body.classList.remove('barsOff');    // 进书先展开工具栏，别一进来就是收着的
    showView('read');
    if (!BK.picture) warmEngine();     // 翻开书 = 多半要听：趁这几秒把推理会话建起来（扫描件念不了，不占这份 CPU）
    hideSelTools();
    renderChapter(meta.ch || 0, { ratio: meta.ratio || 0, silent: true });
    renderSide();
    rtStart(id);
    /* 头一次进阅读器，把新的点击方式说一遍；看过就不再打扰 */
    if (!CFG.tapTip) {
      CFG.tapTip = 1; saveCfg();
      setTimeout(function () { toast(T('点屏幕左右翻页，点中间收 / 放上下工具栏'), 4600); }, 800);
    }
  }
  /* 从书架「续听」：打开书 → 跳到上次听到的那一章那段 → 直接开念 */
  async function resumeListen(id) {
    var b = BOOKS.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    await openBook(id);
    if (!BK) return;
    var ch = Math.min(Math.max(0, b.lCh | 0), Math.max(0, chapterCount() - 1));
    if (ch !== BK.ch) renderChapter(ch, { silent: true });
    await new Promise(function (r) { setTimeout(r, 80); });
    var pi = Math.min(Math.max(0, b.lPi | 0), Math.max(0, SPK.paras.length - 1));
    startSpeak(pi);
    toast(T('从上次听到的地方继续（第 {n} 章）', { n: ch + 1 }), 2800);
  }
  function closeBook() {
    rtFlush();
    stopSpeak(true); savePos(); BK = null;
    CFG.immersive = 0; saveCfg(); clkStop();               // 回书架时退出全屏阅读，计时停表
    try { if (isFull()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var r = ex.call(document); if (r && r.catch) r.catch(function () { }); } } } catch (e) { }
    showView('lib');
    document.body.classList.remove('barsOff');   // 回书架时工具栏状态归零，下次进来是展开的
    $('side').classList.remove('on'); $('speakBar').classList.remove('on');
    hideSelTools();
    clearAssets(); renderShelf();
    wdPushSoon();          // 开了网盘同步的话，离开这本书 30 秒后把进度推上去
  }
  /* 书里正文常自带一个章节标题，和顶部 #chTitle 重复 —— 去重，只留一个 */
  function dedupeHead() {
    var t = $('chTitle'); if (!t) return;
    var norm = function (s) {
      return String(s || '').toLowerCase()
        .replace(/[\s\u3000·・.,，。:：、!！?？"'“”‘’（）()《》〈〉【】\[\]\-—_~～]/g, '');
    };
    var want = norm(t.textContent);
    if (want.length < 2) return;
    var n = 0, el = t.nextElementSibling;
    while (el && n++ < 8) {
      if (el.id === 'chEnd') break;
      var tag = el.tagName;
      if (/^H[1-6]$/.test(tag) || el.classList.contains('rdh') || tag === 'P' || tag === 'DIV') {
        // 整段文字和标题完全一样：不管它是 h2 还是普通段落，都是重复的标题
        var got = norm(el.textContent);
        if (!got) { el = el.nextElementSibling; continue; }
        if (got === want) { el.classList.add('dupH'); return; }
        // 真标题才允许「包含」式匹配（书里常带副标题或多一个「第 x 章」前缀）
        if (/^H[1-6]$/.test(tag) || el.classList.contains('rdh')) {
          if (got.length > 3 && (want.indexOf(got) === 0 || got.indexOf(want) === 0)) {
            el.classList.add('dupH');
            return;
          }
        }
      }
      el = el.nextElementSibling;
    }
  }
  function renderChapter(i, opt) {
    if (!BK) return;
    opt = opt || {};
    i = Math.max(0, Math.min(chapterCount() - 1, i | 0));
    BK.ch = i;
    var html;
    try { html = BK.chapterHtml(i); } catch (e) { html = '<p class="rdp">' + esc(T('本章读取失败：') + e.message) + '</p>'; }
    /* 繁→简只改显示文本，不动书里的数据：关掉开关重新渲染一次就还原 */
    if (Number(CFG.hans) === 1) html = hansify(html);
    var chTitleTx = Number(CFG.hans) === 1 ? hansify(chapterTitle(i)) : chapterTitle(i);
    PG.ready = 0;                                     // 换章了，旧的页数作废
    var tail = BK.picture
      ? esc(T('— 第 {a} / {b} 页 —', { a: i + 1, b: chapterCount() })) + '<br><button data-act="next">' + esc(T('下一页 →')) + '</button>'
      : esc(T('— 本章完 —')) + '<br><button data-act="next">' + esc(T('下一章 →')) + '</button>';
    $('page').innerHTML = '<div id="chTitle">' + esc(chTitleTx) + '</div>' + html +
      '<div id="chEnd">' + tail + '</div>';
    dedupeHead();
    $('pageWrap').scrollTop = 0;
    applyHighlights();
    SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
    // 换章了：把新一章里的人物补进表里（已定过的声线不动），旧人物照样沿用原来的嗓子
    if (SPK.on && CFG.roleOn && localReady()) buildCast(i);
    // 翻页模式：量好列数页数后定位；滚动模式：按比例还原
    if (pgEnabled()) {
      pgMeasure();
      var tp = opt.pg === 'last' ? PG.count - 1 : (opt.ratio ? Math.round((PG.count - 1) * opt.ratio) : 0);
      pgTo(tp, { instant: true });
      waitChapterImages();          // 图/字体晚到时补测一次，免得页数被算少
    }
    applyCfg();
    if (BK.picture) paintPdfPage(i);       // 扫描件：把这一页画出来
    if (!pgEnabled() && opt.ratio) setTimeout(function () {
      var w = $('pageWrap'); w.scrollTop = (w.scrollHeight - w.clientHeight) * opt.ratio;
    }, 60);
    if (opt.anchor) setTimeout(function () {
      var list = $('page').querySelectorAll('[id],[name]'), j, an = String(opt.anchor);
      for (j = 0; j < list.length; j++) {
        if (list[j].id === an || list[j].getAttribute('name') === an) {
          if (pgEnabled()) { var pg = paraPage(list[j]); if (pg !== PG.i) pgTo(pg, { instant: true }); }
          else list[j].scrollIntoView({ block: 'center' });
          break;
        }
      }
    }, 80);
    updateProgress();
    if (!opt.silent) savePos();
    renderSide();
    if (SPK.on && SPK.playing && opt.fromSpeak !== true) { /* 朗读跨章由朗读器接管 */ }
  }
  /* ---------------- 图片层 PDF：按页画出来 ----------------
     一页一个 canvas，宽度铺满正文区，高度由页面比例决定。
     devicePixelRatio 最高按 2.5 算：再高在手机上只是白烧内存，肉眼看不出差别。 */
  var PDFV = { ch: -1, w: 0 };
  /* 画好的页留下几屏：翻回去不用重画，翻过去也常常已经画好了。
     一张 700×1000 的 canvas 约 3 MB，留 4 张，别贪。 */
  var PICC = { map: {}, order: [], max: 4, busy: {} };
  function picCacheClear() { PICC.map = {}; PICC.order = []; PICC.busy = {}; }
  function picCachePut(i, cv) {
    if (PICC.map[i]) return;
    PICC.map[i] = cv; PICC.order.push(i);
    while (PICC.order.length > PICC.max) delete PICC.map[PICC.order.shift()];
  }
  /* 提前把下一页画好（静默，不碰界面）。这一步让往后翻几乎不用等。 */
  function picPreRender(i) {
    if (!BK || !BK.picture || i < 0 || i >= chapterCount()) return;
    if (PICC.map[i] || PICC.busy[i]) return;
    PICC.busy[i] = 1;
    var cv = document.createElement('canvas');
    cv.className = 'pdfc';
    PdfBook.renderPage(BK.buf, i + 1, cv, { width: PDFV.w || 700, dpr: PDFV.dpr || 1, maxH: 4000 })
      .then(function () { picCachePut(i, cv); })
      .catch(function () { })
      .then(function () { delete PICC.busy[i]; });
  }
  function paintPdfPage(i) {
    var box = $('page').querySelector('.pdfpg');
    if (!box || !BK || !BK.buf) return;
    var pw = $('page').clientWidth || 700;
    var w = Math.max(300, Math.min(1600, pw - 4));
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    PDFV.ch = i; PDFV.w = w; PDFV.dpr = dpr;
    if (Math.abs(w - (PDFV.lastW || 0)) > 40) { picCacheClear(); }   // 换了窗口宽度，旧图作废
    PDFV.lastW = w;
    var hit = PICC.map[i];
    if (hit) {
      box.innerHTML = '';
      box.appendChild(hit);
      box.classList.add('ok');
      setTimeout(function () { picPreRender(i + 1); }, 200);
      return;
    }
    var cv = document.createElement('canvas');
    cv.className = 'pdfc';
    box.innerHTML = '';
    box.appendChild(cv);
    var mine = i;
    PdfBook.renderPage(BK.buf, i + 1, cv, { width: w, dpr: dpr, maxH: 4000 })
      .then(function (r) {
        /* 渲染期间已经翻走了：这张 canvas 早就被换掉，别再动它 */
        if (PDFV.ch !== mine) return;
        box.classList.add('ok');
        picCachePut(mine, cv);
        /* 页数比记录的多（重新导入过同一本书）：按实际页数补齐目录 */
        if (r && r.pages && r.pages !== BK.count) { PDFV.pages = r.pages; }
        setTimeout(function () { picPreRender(mine + 1); }, 250);
      })
      .catch(function (e) {
        if (PDFV.ch !== mine) return;
        box.innerHTML = '<div class="pdfld bad">' +
          esc(T('这一页没能画出来：') + (e && e.message ? e.message : '')) + '</div>';
      });
  }

  var saveT = null;
  /* 改高亮 / 笔记后重绘本章，位置保持不动（翻页模式停在原页） */
  function renderKeep(opt) {
    if (!BK) return;
    opt = opt || { silent: true };
    if (pgEnabled()) {
      var was = PG.i;
      renderChapter(BK.ch, opt);
      if (was) pgTo(Math.min(was, PG.count - 1), { instant: true });
    } else {
      var st = $('pageWrap').scrollTop;
      renderChapter(BK.ch, opt);
      $('pageWrap').scrollTop = st;
    }
  }
  function updateProgress() {
    if (!BK) return;
    var n = chapterCount(), r, p, tail = '';
    if (pgEnabled()) {
      r = PG.count > 1 ? PG.i / (PG.count - 1) : 0;
      p = (BK.ch + r) / n * 100;
      tail = ' · ' + T('{a}/{b} 页', { a: PG.i + 1, b: PG.count });
    } else {
      var w = $('pageWrap'), max = Math.max(1, w.scrollHeight - w.clientHeight);
      r = Math.max(0, Math.min(1, w.scrollTop / max));
      p = (BK.ch + r) / n * 100;
    }
    BK.ratio = r;
    $('progRange').value = Math.round(p / 100 * 1000);
    $('progTx').textContent = p.toFixed(1) + '% · ' + (BK.ch + 1) + '/' + n + tail;
  }
  function savePos() {
    if (!BK || !BK.meta) return;
    // 先把这一刻的值抓出来：延迟写入时用户可能已经关书（BK 置空），不能再读 BK
    var m = BK.meta, ch = BK.ch, ratio = BK.ratio || 0, n = Math.max(1, chapterCount());
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      m.ch = ch; m.ratio = ratio; m.progress = (ch + ratio) / n * 100;
      m.last = Date.now();
      dbPut('books', m).catch(function () {});
      var x = BOOKS.filter(function (b) { return b.id === m.id; })[0]; if (x) Object.assign(x, m);
    }, 400);
  }
  function nextCh(d) { if (BK) renderChapter(BK.ch + d); }
  function currentPara() {
    if (pgEnabled()) {
      var t = pgTopPara();
      if (t) return Math.max(0, SPK.paras.indexOf(t));
      // 本页没有段落（例如只剩「本章完」）：取离当前页最近的一段
      var best = 0, bd = 1e9;
      SPK.paras.forEach(function (p, i) {
        var d = Math.abs(paraPage(p) - PG.i);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    var w = $('pageWrap'), top = w.getBoundingClientRect().top, b0 = 0, bd0 = 1e9;
    SPK.paras.forEach(function (p, i) { var dd = Math.abs(p.getBoundingClientRect().top - top - 90); if (dd < bd0) { bd0 = dd; b0 = i; } });
    return b0;
  }

  /* ---------------- 侧栏：目录 / 书签 / 笔记 / 搜索 ---------------- */
  function openSide(tab) {
    var same = tab && tab === SIDE && $('side').classList.contains('on');
    if (same) { closeSide(); return; }        // 再点同一个按钮 = 收起
    SIDE = tab || SIDE; if (tab === 'toc' && tab !== SIDE_PREV) TOC_Q = '';
    SIDE_PREV = SIDE; $('side').classList.add('on');
    $('side').querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === SIDE); });
    renderSide();
    pgAfterLayout();
  }
  function closeSide() {
    if (!$('side').classList.contains('on')) return;
    $('side').classList.remove('on');
    hideSelTools();
    pgAfterLayout();
  }
  function hlChapterLabel(h) { return T('第 {n} 章', { n: (h.ch | 0) + 1 }) + ' · ' + chapterTitle(h.ch); }
  var TOC_Q = '', SIDE_PREV = '';
  function tocListHTML(q) {
    var toc = BK.toc && BK.toc.length ? BK.toc : BK.titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; });
    var key = String(q || '').trim().toLowerCase();
    var list = key ? toc.filter(function (t) { return String(t.label || '').toLowerCase().indexOf(key) >= 0; }) : toc;
    var html = list.slice(0, 2000).map(function (t) {
      return '<button class="it' + (t.ch === BK.ch ? ' cur' : '') + (t.level ? ' lv' + Math.min(2, t.level) : '') +
        '" data-ch="' + t.ch + '" data-anchor="' + esc(t.anchor || '') + '">' + esc(showText(t.label)) + '</button>';
    }).join('');
    if (!html) {
      html = '<div class="hint">' + esc(key ? T('没有匹配的章节') : T('这本书没有目录')) + '</div>';
    } else if (key) {
      html = '<div class="hint">' + esc(T('匹配 {n} 章', { n: list.length })) + '</div>' + html;
    }
    return html;
  }
  function renderSide() {
    if (!BK || !$('side').classList.contains('on')) return;
    var b = $('sideBody'), html = '';
    if (SIDE === 'toc') {
      html = '<input type="search" id="tocQ" class="q" data-i18n-ph="搜索章节…" placeholder="' + esc(T('搜索章节…')) +
        '" value="' + esc(TOC_Q) + '" autocomplete="off"><div id="tocList">' + tocListHTML(TOC_Q) + '</div>';
    } else if (SIDE === 'mark') {
      var ms = (BK.meta.marks || []).slice().sort(function (a, c) { return c.ts - a.ts; });
      html = '<div class="row" style="margin:0 0 8px"><button id="sideAddMark">' + esc(T('＋ 在当前位置加书签')) + '</button></div>' +
        (ms.length ? ms.map(function (m, i) {
          return '<div class="it" style="display:flex;gap:6px;align-items:flex-start"><button class="it" style="flex:1;text-align:left;padding:4px" data-mark="' + i + '">' +
            esc(m.text.slice(0, 40)) + '<br><span class="hint">' + fmtDate(m.ts) + ' · ' + esc(T('第 {n} 章', { n: (m.ch | 0) + 1 })) + '</span></button>' +
            '<button class="ghost danger" data-delmark="' + m.ts + '" title="' + esc(T('删除')) + '">×</button></div>';
        }).join('') : '<div class="hint">' + esc(T('还没有书签。读到哪儿，点「＋书签」记一下。')) + '</div>');
    } else if (SIDE === 'note') {
      var hs = hlList(BK.meta).slice().sort(function (a, c) { return (a.ch - c.ch) || (a.p - c.p); });
      var notes = hs.filter(function (h) { return h.note; });
      var onlyNote = CFG.noteFilter === 'note', show = onlyNote ? notes : hs;
      html = '<div style="display:flex;gap:5px;margin-bottom:9px;flex-wrap:wrap">' +
        '<button data-nf="all" class="' + (onlyNote ? '' : 'on') + '" style="font-size:.82em">' + esc(T('全部批注')) + ' ' + hs.length + '</button>' +
        '<button data-nf="note" class="' + (onlyNote ? 'on' : '') + '" style="font-size:.82em">' + esc(T('仅看有笔记的')) + ' ' + notes.length + '</button>' +
        '</div>' +
        (show.length ? show.map(function (h, i) {
          return '<div class="noteIt" data-hlgo="' + esc(h.id) + '">' +
            '<div class="q"><span class="dot noteclr-' + (h.c || 'y') + '" style="margin-right:5px"></span>' + esc(h.text.slice(0, 180)) + '</div>' +
            (h.note ? '<div class="cm">' + esc(h.note.slice(0, 240)) + '</div>' : '') +
            '<div class="ft"><span>' + esc(hlChapterLabel(h)) + '</span><span class="spacer"></span>' +
            '<button data-hledit="' + esc(h.id) + '" title="' + esc(T('编辑笔记')) + '">✎</button>' +
            '<button data-hlshare="' + esc(h.id) + '" title="' + esc(T('分享划线')) + '">↗</button>' +
            '<button data-hldel="' + esc(h.id) + '" class="danger" title="' + esc(T('删除')) + '">×</button></div></div>';
        }).join('') : '<div class="hint" style="line-height:1.9">' + esc(T('还没有笔记。选中正文里的句子，就能高亮、写批注。')) + '</div>') +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">' +
        '<button id="noteExp">' + esc(T('导出笔记')) + '</button>' +
        '<button id="noteSum">' + esc(T('阅读总结')) + '</button></div>';
    } else {
      html = '<div style="display:flex;gap:6px;margin-bottom:9px"><input class="q" type="search" id="findQ" placeholder="' +
        esc(T('全书搜索关键词')) + '"><button id="findGo">' + esc(T('搜')) + '</button></div>' +
        '<div id="findStat" class="hint">' + esc(T('支持当前 EPUB / TXT 全文，最多显示 200 条')) + '</div><div id="findRes"></div>';
    }
    b.innerHTML = html;
    if (SIDE === 'find') {
      var q = $('findQ');
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFind(q.value); });
      $('findGo').addEventListener('click', function () { doFind(q.value); });
      q.focus();
    }
  }
  async function doFind(query) {
    var q = (query || '').trim(); if (!q || !BK) return;
    var tok = ++SEARCHTOK, res = [], low = q.toLowerCase(), stat = $('findStat');
    stat.textContent = T('搜索中… {a}/{b}', { a: 0, b: chapterCount() });
    for (var i = 0; i < chapterCount(); i++) {
      var t; try { t = BK.chapterText(i); } catch (e) { continue; }
      if (Number(CFG.hans) === 1) t = hansify(t);   // 显示的是简体，搜简体才搜得到
      var idx = t.toLowerCase().indexOf(low);
      while (idx >= 0 && res.length < 200) {
        res.push({ ch: i, label: showText(chapterTitle(i)), text: t.slice(Math.max(0, idx - 22), idx + q.length + 34) });
        idx = t.toLowerCase().indexOf(low, idx + q.length);
        if (res.length >= 200) break;
      }
      if (i % 8 === 0) { stat.textContent = T('搜索中… {a}/{b}', { a: i + 1, b: chapterCount() }) + ' · ' + T('命中 {n}', { n: res.length }); await sleep(0); }
      if (tok !== SEARCHTOK || res.length >= 200) break;
    }
    if (tok !== SEARCHTOK) return;
    stat.textContent = res.length ? T('共 {n} 处', { n: res.length }) + (res.length >= 200 ? T('（已截断）') : '') : T('没找到「{q}」', { q: q });
    $('findRes').innerHTML = res.map(function (r) {
      return '<button class="it" data-ch="' + r.ch + '" data-q="' + esc(q) + '"><b>' + esc(r.label) + '</b><br><span class="hint">…' + esc(r.text) + '…</span></button>';
    }).join('');
  }
  function addMark() {
    if (!BK) return;
    var p = currentPara(), t = (SPK.paras[p] ? SPK.paras[p].textContent : '').trim().slice(0, 80) || chapterTitle(BK.ch);
    BK.meta.marks = BK.meta.marks || [];
    BK.meta.marks.push({ ch: BK.ch, p: p, text: t, ts: Date.now() });
    savePos(); toast(T('已加书签')); if (SIDE === 'mark') renderSide();
  }

  /* ---------------- 划线高亮与批注 ----------------
     选区只在段落内部定位：段落序号 + 段内字符区间。渲染章节后按区间重新包 <mark>，
     EPUB 的内联标签由 TreeWalker 按纯文本长度算，跨节点也能量准。 */
  var SEL = { text: '', ch: 0, p: 0, s: 0, e: 0, rect: null };
  function persistBook() {
    if (!BK || !BK.meta) return;
    dbPut('books', BK.meta).catch(function () { });
    var x = bookOf(BK.meta.id); if (x) Object.assign(x, BK.meta);
  }
  function closestPara(node) {
    var e = node && node.nodeType === 1 ? node : (node ? node.parentElement : null);
    if (!e) return null;
    if (e.closest) return e.closest('.rdp');
    return null;
  }
  function textOffsetIn(para, node, offset) {
    var w = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null), n, acc = 0;
    while ((n = w.nextNode())) {
      if (n === node) return acc + offset;
      acc += n.nodeValue.length;
    }
    return -1;
  }
  function rangeAt(para, s, e) {
    var w = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null), n, acc = 0, a = null, b = null;
    while ((n = w.nextNode())) {
      var len = n.nodeValue.length;
      if (a === null && s <= acc + len) a = { n: n, o: Math.max(0, s - acc) };
      if (e <= acc + len) { b = { n: n, o: Math.max(0, e - acc) }; break; }
      acc += len;
    }
    if (!a || !b) return null;
    var r = document.createRange();
    try {
      r.setStart(a.n, Math.min(a.o, a.n.nodeValue.length));
      r.setEnd(b.n, Math.min(b.o, b.n.nodeValue.length));
    } catch (err) { return null; }
    return r.collapsed ? null : r;
  }
  function wrapRange(range, cls) {
    var frag;
    try { frag = range.extractContents(); } catch (e) { return null; }
    var m = document.createElement('mark');
    if (cls) m.className = cls;
    m.appendChild(frag);
    try { range.insertNode(m); } catch (e) { return null; }
    return m;
  }
  /* 章节渲染完成后还原本章的所有高亮 */
  function applyHighlights() {
    var page = $('page');
    if (!page || !BK || !BK.meta) return;
    var list = hlList(BK.meta).filter(function (h) { return h.ch === BK.ch; });
    if (!list.length) return;
    var paras = page.querySelectorAll('.rdp');
    list.forEach(function (h) {
      var p = paras[h.p]; if (!p) return;
      var r = rangeAt(p, h.s, h.e);
      // 段落内容变动（换字号不会，换编码/重排会）：退化为按原文查找
      if (!r || p.textContent.substr(h.s, h.e - h.s) !== h.text) {
        var i = p.textContent.indexOf(h.text);
        if (i < 0) return;
        r = rangeAt(p, i, i + h.text.length);
      }
      if (!r) return;
      var m = wrapRange(r, 'hl-' + (h.c || 'y') + (h.note ? ' hasNote' : ''));
      if (!m) return;
      m.setAttribute('data-hlid', h.id);
      if (h.note) m.title = h.note;
    });
  }
  /* ---- 选区工具条 ---- */
  function readSelection() {
    var s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    var range = s.getRangeAt(0), page = $('page');
    if (!page || !page.contains(range.startContainer) || !page.contains(range.endContainer)) return null;
    var p0 = closestPara(range.startContainer), p1 = closestPara(range.endContainer);
    if (!p0) return null;
    if (p1 && p1 !== p0) {                      // 跨段选区：只取第一段内的部分
      range = range.cloneRange();
      try { range.setEnd(p0, p0.childNodes.length); } catch (e) { }
    }
    var txt = String(range.toString() || '').replace(/\s+/g, ' ').trim();
    if (!txt || txt.length > 1000) return null;
    var paras = Array.prototype.slice.call(page.querySelectorAll('.rdp'));
    var idx = paras.indexOf(p0);
    if (idx < 0) return null;
    var s0 = textOffsetIn(p0, range.startContainer, range.startOffset);
    var s1 = textOffsetIn(p0, range.endContainer, range.endOffset);
    if (s0 < 0 || s1 <= s0) return null;
    return { text: txt, ch: BK ? BK.ch : 0, p: idx, s: s0, e: s1, rect: range.getBoundingClientRect() };
  }
  function showSelTools(sel) {
    var box = $('selTools');
    SEL = sel;
    box.classList.add('on');
    var bw = box.offsetWidth || 260, bh = box.offsetHeight || 36;
    var r = sel.rect || { left: 0, top: 0, width: 0, bottom: 0 };
    var x = r.left + r.width / 2 - bw / 2, y = r.top - bh - 10;
    if (y < 6) y = r.bottom + 10;
    x = Math.max(6, Math.min(window.innerWidth - bw - 6, x));
    box.style.left = x + 'px'; box.style.top = y + 'px';
  }
  function hideSelTools() { var b = $('selTools'); if (b) b.classList.remove('on'); }
  function onSelUp() {
    if (!$('viewRead').classList.contains('on')) return;
    setTimeout(function () {
      var sel = readSelection();
      if (sel) showSelTools(sel); else hideSelTools();
    }, 10);
  }
  function addHighlight(color, note) {
    if (!SEL.text || !BK) return;
    var hl = {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ch: SEL.ch, p: SEL.p, s: SEL.s, e: SEL.e, text: SEL.text,
      note: note || '', c: color || 'y', ts: Date.now()
    };
    BK.meta.hl = BK.meta.hl || [];
    BK.meta.hl.push(hl);
    persistBook();
    renderKeep();
    hideSelTools();
    try { window.getSelection().removeAllRanges(); } catch (e) { }
    if (!note) toast(T('已高亮'), 1400);
    if (SIDE === 'note') renderSide();
    return hl;
  }
  function hlById(id) { return hlList(BK && BK.meta).filter(function (h) { return h.id === id; })[0]; }
  function removeHighlight(id) {
    if (!BK) return;
    BK.meta.hl = hlList(BK.meta).filter(function (h) { return h.id !== id; });
    persistBook();
    renderKeep();
    if (SIDE === 'note') renderSide();
    toast(T('已删除批注'), 1600);
  }
  function noteEditor(hl) {
    if (!hl) return;
    showModal(T('编辑笔记'),
      '<div class="kv" style="margin-bottom:10px;line-height:1.7">' + esc(hl.text.slice(0, 220)) +
      (hl.text.length > 220 ? '…' : '') + '</div>' +
      '<textarea id="noteTx" rows="5" placeholder="' + esc(T('写下你的想法…')) +
      '" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--tx);font-size:inherit;line-height:1.7;resize:vertical">' +
      esc(hl.note || '') + '</textarea>',
      [{ label: T('删除'), cls: 'danger', fn: function () { closeModal(); removeHighlight(hl.id); } },
        { label: T('取消') },
        { label: T('保存'), cls: 'pri', fn: function () {
          hl.note = ($('noteTx').value || '').trim();
          persistBook(); closeModal();
          renderKeep();
          if (SIDE === 'note') renderSide();
          toast(T('已保存'), 1400);
        } }]);
    setTimeout(function () { var x = $('noteTx'); if (x) x.focus(); }, 60);
  }
  /* 点已有高亮：菜单（换色 / 编辑笔记 / 分享 / 删除） */
  function hlMenu(id) {
    var h = hlById(id); if (!h) return;
    var colors = HL_COLORS.map(function (c) {
      return '<button data-hc="' + c + '" style="width:30px;height:30px;min-height:30px;padding:0;border-radius:50%;background:' +
        ({ y: '#FFD666', g: '#7AD68C', b: '#7AB2FF', p: '#FF96C4' })[c] + ';border:2px solid ' +
        (h.c === c ? 'var(--acc)' : 'transparent') + '" title="' + esc(T('高亮颜色')) + '"></button>';
    }).join('');
    showModal(T('批注'),
      '<div class="kv" style="line-height:1.8;margin-bottom:10px">' + esc(h.text) + '</div>' +
      (h.note ? '<p style="margin-bottom:10px">' + esc(h.note) + '</p>' : '') +
      '<div class="row"><label>' + esc(T('高亮颜色')) + '</label><div class="seg">' + colors + '</div></div>',
      [{ label: T('取消高亮'), cls: 'danger', fn: function () { closeModal(); removeHighlight(h.id); } },
        { label: T('分享划线'), fn: function () { closeModal(); shareHighlight(h); } },
        { label: T('编辑笔记'), cls: 'pri', fn: function () { closeModal(); noteEditor(h); } }]);
    $('modalBody').onclick = function (e) {
      var c = e.target.closest('[data-hc]'); if (!c) return;
      h.c = c.getAttribute('data-hc');
      persistBook(); closeModal();
      renderKeep();
      if (SIDE === 'note') renderSide();
    };
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return legacyCopy(txt); });
    }
    return Promise.resolve(legacyCopy(txt));
  }
  function legacyCopy(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return true;
    } catch (e) { return false; }
  }
  /* ---- 分享卡片：canvas 画一张 1080 宽的图文 ---- */
  function wrapLines(g, text, maxW) {
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function shareHighlight(hl) {
    if (!hl) return;
    var W = 1080, pad = 92, fs = 46, lh = 1.72;
    var cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = fs + 'px "Noto Serif CJK SC","Songti SC",serif';
    var body = hl.text.length > 340 ? hl.text.slice(0, 340) + '…' : hl.text;
    var lines = wrapLines(g, body, W - pad * 2).slice(0, 14);
    var H = pad + 92 + lines.length * fs * lh + 150 + pad;
    cv.width = W; cv.height = H;
    g = cv.getContext('2d');
    g.fillStyle = '#FAF7F0'; g.fillRect(0, 0, W, H);
    // 左侧装饰竖线
    g.fillStyle = '#B08A5A'; g.fillRect(pad, pad + 88, 6, lines.length * fs * lh - 8);
    // 书名与章节
    g.fillStyle = '#8A7A63'; g.font = '30px "Microsoft YaHei",system-ui,sans-serif';
    var meta = (BK ? BK.meta.name : '') + (hl.ch != null && BK ? ' · ' + chapterTitle(hl.ch) : '');
    g.fillText(meta.length > 26 ? meta.slice(0, 26) + '…' : meta, pad + 26, pad + 44);
    // 正文
    g.fillStyle = '#2C2620'; g.font = fs + 'px "Noto Serif CJK SC","Songti SC",serif';
    lines.forEach(function (ln, i) { g.fillText(ln, pad + 30, pad + 88 + fs * 0.95 + i * fs * lh); });
    // 脚注
    var by = H - pad - 46;
    g.fillStyle = '#B08A5A'; g.fillRect(pad, by - 40, W - pad * 2, 2);
    g.fillStyle = '#8A7A63'; g.font = '28px "Microsoft YaHei",system-ui,sans-serif';
    g.fillText(T('墨吟 · 阅读与朗读'), pad, by + 4);
    var mark = '© 永远的兰兰';
    g.textAlign = 'right'; g.fillText(mark, W - pad, by + 4); g.textAlign = 'left';
    var name = (BK ? BK.meta.name : 'highlight').replace(/[\\/:*?"<>|]/g, '_').slice(0, 24);
    try {
      var url = cv.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url; a.download = name + '-划线.png';
      document.body.appendChild(a); a.click(); a.remove();
      toast(T('分享图已保存'), 2600);
    } catch (e) {
      toast(T('生成分享图失败：') + e.message, 3600);
    }
  }

  /* ---------------- 导出笔记 / 阅读总结 ---------------- */
  function fmtDateTime(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fmtShort(ts) {
    var d = new Date(ts || Date.now());
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function notesMarkdown(b) {
    b = b || (BK && BK.meta);
    if (!b) return '';
    var hs = hlList(b).slice().sort(function (x, y) { return (x.ch - y.ch) || (x.p - y.p); });
    var out = '# ' + (b.name || '') + '\n\n';
    if (b.author) out += '> ' + b.author + '\n\n';
    out += '-' + T('导出时间：') + fmtDateTime() + '\n';
    out += '- ' + T('批注数：') + hs.length + '（' + T('其中带笔记 ') + hs.filter(function (h) { return h.note; }).length + '）\n\n';
    var lastCh = -1;
    hs.forEach(function (h) {
      if (h.ch !== lastCh) {
        lastCh = h.ch;
        out += '\n## ' + T('第 {n} 章', { n: (h.ch | 0) + 1 }) + ' · ' + chapterTitle(h.ch) + '\n\n';
      }
      out += '> ' + String(h.text).replace(/\n/g, ' ') + '\n\n';
      if (h.note) out += T('笔记：') + h.note + '\n\n';
    });
    return out;
  }
  function exportNotes() {
    if (!BK || !BK.meta) return;
    var hs = hlList(BK.meta);
    if (!hs.length) { toast(T('还没有划线或批注')); return; }
    var name = (BK.meta.name || 'notes').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    download(name + '-笔记.md', notesMarkdown(BK.meta), 'text/markdown;charset=utf-8');
    toast(T('笔记已导出'), 2400);
  }
  function gotoHighlight(h) {
    if (!h) return;
    if (h.ch !== BK.ch) renderChapter(h.ch, { silent: true });
    setTimeout(function () {
      var m = $('page').querySelector('mark[data-hlid="' + h.id + '"]');
      if (m) revealPara(m, true);
      else { var p = SPK.paras[h.p]; if (p) revealPara(p); }
    }, 90);
  }
  function showSummary() {
    if (!BK || !BK.meta) return;
    var b = BK.meta, hs = hlList(b).slice().sort(function (x, y) { return (x.ch - y.ch) || (x.p - y.p); });
    var notes = hs.filter(function (h) { return h.note; });
    var n = Math.max(1, chapterCount());
    var prog = ((b.ch || 0) + (b.ratio || 0)) / n * 100;
    var days = b.first ? Math.max(1, Math.ceil((Date.now() - b.first) / 86400000)) : 1;
    var avg = b.sessions ? Math.round((b.rt || 0) / b.sessions) : 0;
    var cells = [
      [T('累计阅读'), b.rt ? fmtDur(b.rt) : '—'],
      [T('阅读进度'), prog.toFixed(1) + '%'],
      [T('章节'), (b.ch || 0) + 1 + ' / ' + chapterCount()],
      [T('批注数'), String(hs.length)],
      [T('其中笔记'), String(notes.length)],
      [T('书签数'), String((b.marks || []).length)],
      [T('阅读天数'), T('{n} 天', { n: days })],
      [T('平均每次'), avg ? fmtDur(avg) : '—'],
      [T('上次阅读'), b.last ? fmtShort(b.last) : '—']
    ];
    var ex = hs.map(function (h) {
      return '<div class="e"><div class="t">' + esc(h.text) + '</div>' +
        (h.note ? '<div class="n">' + esc(h.note) + '</div>' : '') +
        '<div class="h">' + esc(T('第 {n} 章', { n: (h.ch | 0) + 1 })) + ' · ' + fmtDateTime(h.ts) + '</div></div>';
    }).join('') || '<div class="hint" style="padding:8px">' + esc(T('还没有划线或批注')) + '</div>';
    showModal(T('阅读总结') + ' · ' + b.name,
      '<div class="sumGrid">' + cells.map(function (c) {
        return '<div class="c"><b>' + esc(String(c[1])) + '</b><span>' + esc(c[0]) + '</span></div>';
      }).join('') + '</div>' +
      '<h3>' + esc(T('本书摘录')) + ' <span class="kv" style="font-weight:400">' + hs.length + '</span></h3>' +
      '<p class="kv">' + esc(T('按章节顺序汇总你划过的高亮与批注，可导出成 Markdown 笔记。')) + '</p>' +
      '<div class="sumEx">' + ex + '</div>',
      [{ label: T('导出笔记'), fn: exportNotes },
        { label: T('复制全部'), fn: function () { copyText(notesMarkdown(b)).then(function (ok) { toast(ok ? T('已复制') : T('复制失败，请手动选择文本')); }); } },
        { label: T('关闭'), cls: 'pri' }]);
  }

  /* ---------------- 朗读 ---------------- */
  var SPK = { on: false, playing: false, pi: 0, ci: 0, chunks: [], cv: [], paras: [], gen: 0,
    cast: {}, castName: {}, used: {}, sex: {},
    /* scene：这一小段的「在场人物」——最近开口的男/女是谁、上一位用的哪个声线。
       代词「他/她」和没写主的对白都靠它接住，绝不临时另配一个新声音。
       main：全书出场最多的男/女，认不出时的最后一级兜底。 */
    scene: { f: '', m: '', lastWho: '', lastV: '' }, main: { f: '', m: '' }, castAt: '',
    watch: null, deadline: 0, timer: null, gapT: null, fb: 0, seenEnd: false, trying: false,
    audio: null, pref: {}, pre: {}, pcm: {}, fillQ: null, fillGen: 0,
    fails: 0, skipped: 0, degraded: 0, slowTold: 0, slowN: 0 };      // fails：真失败次数（到阈值才弹窗）；slowN：引擎「还在准备」跳过几句；slowTold：本次已提示过准备中；degraded：本次已退回系统语音
  /* 听书时让屏幕保持常亮：手机一熄屏，WebView 里的音频立刻被系统掐掉，
     走路、做家务时听书就断在半句上。Wake Lock 失败（旧内核 / file://）就算了，
     只是不如常亮，不影响朗读本身。 */
  var WAKE = null;
  function wakeKeep(on) {
    try {
      if (on) {
        if (WAKE || !navigator.wakeLock || !navigator.wakeLock.request) return;
        navigator.wakeLock.request('screen').then(function (s) {
          WAKE = s;
          if (s.addEventListener) s.addEventListener('release', function () { if (WAKE === s) WAKE = null; });
        })['catch'](function () { });
      } else if (WAKE) {
        try { WAKE.release(); } catch (e) { }
        WAKE = null;
      }
    } catch (e) { /* 老内核没有这个 API */ }
  }
  /* 切到后台 Wake Lock 会被系统收回，回前台且还在念时要重新要一次 */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && SPK.playing) wakeKeep(true);
  });
  /* 免费离线神经语音：本机 sherpa-onnx + 一份 16 kHz 的 187 人多说话人模型。
     1.14.40 起成品不再带两份 22 kHz 主角（小雅 / 超文，省 25 MB 压缩后体积）：
     187 条声线全部常驻、靠 --sid 换人，一句 19 字 0.92 秒，跟主角同速。
     老 VoicePack 目录里还有 x0 / c0 时仍会列出来，所以这里保留它们的兜底能力。
     每项：[音色 key, 显示名, 音高分档]；服务在线时用 /health 返回的全量表，
     服务没起来时用下面这份精选 50 个兜底（缺文件的音色会自动隐藏）。 */
  var LOCAL_VOICES = [
    ['s124',  '老生 · 低沉 1',          '男声 · 低沉'],
    ['s74',   '老生 · 低沉 2',          '男声 · 低沉'],
    ['s119',  '男声 · 低沉 3',          '男声 · 低沉'],
    ['s40',   '男声 · 低沉 4',          '男声 · 低沉'],
    ['s58',   '中年男 1',                '男声 · 中年'],
    ['s163',  '中年男 2',                '男声 · 中年'],
    ['s156',  '中年男 3',                '男声 · 中年'],
    ['s98',   '中年男 4',                '男声 · 中年'],
    ['s143',  '中年男 5',                '男声 · 中年'],
    ['s107',  '中年男 6',                '男声 · 中年'],
    ['s167',  '中年男 7',               '男声 · 中年'],
    ['s76',   '男声 · 偏高 1',          '男声 · 偏高'],
    ['s52',   '男声 · 中音 1',          '男声 · 中年'],
    ['s110',  '男声 · 中音 2',          '男声 · 中年'],
    ['s102',  '男声 · 中音 3',          '男声 · 中年'],
    ['s65',   '男声 · 偏高 2',          '男声 · 偏高'],
    ['s174',  '青年男 1',                '男声 · 偏高'],
    ['s32',   '青年男 2',                '男声 · 偏高'],
    ['s148',  '青年男 3',                '男声 · 偏高'],
    ['s72',   '青年男 4',                '男声 · 偏高'],
    ['s83',   '青年男 5',                '男声 · 偏高'],
    ['s36',   '女声 · 低音 1',          '女声 · 低音'],
    ['s23',   '女声 · 低音 2',          '女声 · 低音'],
    ['s144',  '女声 · 低音 3',          '女声 · 低音'],
    ['s169',  '沉稳女 1',                '女声 · 低音'],
    ['s13',   '成年女 1',                '女声 · 成年'],
    ['s149',  '成年女 2',                '女声 · 成年'],
    ['s19',   '成年女 3',                '女声 · 成年'],
    ['s165',  '成年女 4',                '女声 · 成年'],
    ['s84',   '成年女 5',                '女声 · 成年'],
    ['s178',  '成年女 6',                '女声 · 成年'],
    ['s6',    '青年女 9',                '女声 · 青年'],
    ['s77',   '青年女 10',               '女声 · 青年'],
    ['s129',  '青年女 1',                '女声 · 青年'],
    ['s164',  '青年女 11',               '女声 · 青年'],
    ['s120',  '青年女 2',                '女声 · 青年'],
    ['s22',   '青年女 12',               '女声 · 青年'],
    ['s103',  '青年女 13',               '女声 · 青年'],
    ['s20',   '青年女 3',                '女声 · 青年'],
    ['s28',   '青年女 4',                '女声 · 青年'],
    ['s185',  '青年女 5',                '女声 · 青年'],
    ['s71',   '青年女 6',                '女声 · 青年'],
    ['s108',  '青年女 7',                '女声 · 青年'],
    ['s68',   '青年女 14',               '女声 · 青年'],
    ['s85',   '青年女 15',              '女声 · 青年'],
    ['s64',   '青年女 8',                '女声 · 高音'],
    ['s125',  '女声 · 高音 1',          '女声 · 高音'],
    ['s139',  '女声 · 高音 2',          '女声 · 高音'],
    ['s41',   '童声 1',                  '女声 · 高音'],
    ['s105',  '童声 2',                  '女声 · 高音'],
  ];
  /* 用 /health 的结果构造全量列表：精选排最前，其余按基频从低到高，
     正好自然落进「男低 → 男中 → 男亮 → 女沉 → 女中 → 女清亮 → 女高」7 个档。 */
  function buildVoiceList(info) {
    if (!info || !info.labels) return null;
    var lb = info.labels, g = info.groups || {}, f0 = info.f0 || {}, cur = info.curated || [], out = [];
    cur.forEach(function (k) { if (lb[k]) out.push([k, lb[k], g[k] || '']); });
    Object.keys(lb).filter(function (k) { return cur.indexOf(k) < 0; })
      .sort(function (a, b) { return (f0[a] || 0) - (f0[b] || 0); })
      .forEach(function (k) { out.push([k, lb[k], g[k] || '']); });
    return out;
  }
  function localVoiceName(k) {
    var x = (LOCAL.list || LOCAL_VOICES).filter(function (a) { return a[0] === k; })[0];
    if (!x) return k;
    return (/号$/.test(x[1]) && x[2]) ? x[1] + '（' + x[2] + '）' : x[1];
  }
  /* 精选 / 全部：精选只列人工命名过的 50 个（桌面端；手机端 30 个）；
     全部则按音高分 7 组列出 187 个。数字一律取自 /health，别在这里写死。 */
  function localVoiceList() {
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var all = LOCAL.list || LOCAL_VOICES;
    if (av) all = all.filter(function (x) { return av[x[0]] !== false; });
    if (!LOCAL.list || CFG.voiceSet === 'all') return all;
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var only = all.filter(function (x) { return cur.indexOf(x[0]) >= 0; });
    return only.length ? only : all;
  }
  function voiceGroup(x, forceAll) {
    var cur = (LOCAL.info && LOCAL.info.curated) || null;
    if (cur && cur.indexOf(x[0]) >= 0) return T('⭐ 推荐音色');
    if ((forceAll || CFG.voiceSet === 'all') && LOCAL.list) return T(x[2] || '其他音色');
    return T('⭐ 推荐音色');
  }
  /* forceAll：设置页永远列全库（187 + 主角），不受「声线范围」影响。
     范围只该管朗读条那个短下拉——设置页是用来翻库、挑新声音的地方，
     在这里藏起 166 个声线，用户就再也没地方把它们找出来了。 */
  function localVoiceOptions(forceAll) {
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var list = forceAll ? (LOCAL.list || LOCAL_VOICES) : localVoiceList();
    if (forceAll && av) list = list.filter(function (x) { return av[x[0]] !== false; });
    var html = '', last = null;
    list.forEach(function (x) {
      var g = voiceGroup(x, forceAll);
      if (g !== last) {
        if (last !== null) html += '</optgroup>';
        html += '<optgroup label="' + esc(g) + '">'; last = g;
      }
      html += '<option value="' + x[0] + '"' + (CFG.localVoice === x[0] ? ' selected' : '') + '>' + esc(T(x[1])) + '</option>';
    });
    return html + (last !== null ? '</optgroup>' : '');
  }
  /* 旧配置指向已删除 / 未安装的音色时，自动落到第一个可用音色。
     引擎说了默认是谁（/health 的 default）就用它——精简包没有 x0，
     列表第一个是低音男声（老生 · 低沉），拿来念旁白没法听。 */
  function fixLocalVoice() {
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var pool = (LOCAL.list || LOCAL_VOICES).filter(function (x) { return !av || av[x[0]] !== false; });
    if (!pool.length) return;
    if (!pool.some(function (x) { return x[0] === CFG.localVoice; })) {
      var def = LOCAL.info && LOCAL.info['default'];
      var pick = (def && pool.some(function (x) { return x[0] === def; })) ? def : pool[0][0];
      CFG.localVoice = pick; saveCfg();
    }
  }

  /* ---------------- 旁白的男声 / 女声 ----------------
     同一本书适合女声娓娓道来，换一本武侠/历史可能男声更对味。所以旁白留两条：
     男一条、女一条，都记在本机，设置页与朗读条各有一个一键切换的入口。
     当前真正在用的是 CFG.localVoice，这两条只是「这个性别上次选的是谁」。 */
  var NARR_FALLBACK_M = ['s32', 's167', 's52', 's102', 's58'];
  var NARR_FALLBACK_F = ['s36', 's13', 's149', 's129', 's169'];
  function fixNarr() {
    if (!localReady()) return 0;
    var core = fixedVoiceKeys();                 // [女, 男]，精简版是空的
    var firstOk = function (list) {
      for (var i = 0; i < list.length; i++) if (voiceUsable(list[i])) return list[i];
      return '';
    };
    var ch = 0;
    /* 一开始就在听男声的，别把「男声旁白」记成别的：先认当前旁白 */
    if (!voiceUsable(CFG.narrF)) {
      CFG.narrF = core[0] || firstOk(NARR_FALLBACK_F) || CFG.localVoice; ch++;
    }
    if (!voiceUsable(CFG.narrM)) {
      CFG.narrM = (voiceGender(CFG.localVoice) === 'm' && voiceUsable(CFG.localVoice))
        ? CFG.localVoice : (core[1] || firstOk(NARR_FALLBACK_M)); ch++;
    }
    if (ch) saveCfg();
    return ch;
  }
  function setNarr(g) {
    var k = (g === 'm' ? CFG.narrM : CFG.narrF);
    var who = g === 'm' ? T('男声') : T('女声');
    if (!k) { toast(T('{r}旁白还没选过声线，先在上面挑一个', { r: who }), 3000); return; }
    if (k === CFG.localVoice) { toast(T('旁白已经是 {v}', { v: localVoiceName(k) }), 2400); return; }
    pickLocalVoice(k, true);
    toast(T('旁白换成{r}：{v}', { r: who, v: localVoiceName(k) }), 2600);
  }

  /* ---------------- 男女主角的声线 ----------------
     完整版有 22 kHz 的两份主角模型，主角就用它们；精简版没有，从 187 人库里挑。
     为什么不能留给角色池自己发：池子按精选表顺序取，头一个是 s124（118 Hz
     「老生 · 低沉 1」），于是全书男主一开口就是最沉的那嗓子——「男声太低」
     其实是这个顺序造成的，不是缺候选。 */
  var LEAD_FALLBACK_M = ['s32', 's167', 's52', 's102', 's58'];
  var LEAD_FALLBACK_F = ['s13', 's149', 's36', 's129', 's169'];
  function voiceUsable(k) {
    if (!k) return false;
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    if (av && av[k] === false) return false;
    return (LOCAL.list || LOCAL_VOICES).some(function (x) { return x[0] === k; });
  }
  /* 补默认：指向的声线不在了（换了语音包 / 首次启动）就按模式挑一个 */
  function fixLead() {
    if (!localReady()) return 0;
    var core = fixedVoiceKeys();          // [女, 男]，精简版是空的
    var firstOk = function (list, avoid) {
      for (var i = 0; i < list.length; i++) {
        if (voiceUsable(list[i]) && list[i] !== avoid) return list[i];
      }
      return '';
    };
    var ch = 0;
    if (!voiceUsable(CFG.leadM)) {
      CFG.leadM = core[1] || firstOk(LEAD_FALLBACK_M, CFG.localVoice); ch++;
    }
    if (!voiceUsable(CFG.leadF)) {
      /* 完整版就用 22 kHz 的主角女声，哪怕和旁白是同一个——那本来就是书里的女主。
         只有精简版（没有主角模型）才要避开旁白，换一条别的女声，不然女主和旁白
         一模一样，分角色等于白开。 */
      var f = core[0];
      if (!f) f = firstOk(LEAD_FALLBACK_F, CFG.localVoice);
      CFG.leadF = f; ch++;
    }
    if (ch) saveCfg();
    return ch;
  }
  /* who 是不是这本书的男女主；是就返回该用的那条声线，否则空（照旧走角色池） */
  function leadFor(who, g) {
    if (!who || !CFG.roleOn) return '';
    var main = (g === 'm' ? SPK.main.m : g === 'f' ? SPK.main.f : '');
    if (!main || who !== main) return '';
    var k = (g === 'm' ? CFG.leadM : CFG.leadF);
    return voiceUsable(k) ? k : '';
  }
  function setLead(g, k) {
    if (!k) return;
    if (g === 'm') CFG.leadM = k; else CFG.leadF = k;
    saveCfg(); resetCast();                // 主角换人，角色分配要重排
    fillVoices();
    toast(T('{r}的主角声线已设为 {v}', {
      r: g === 'm' ? T('男主') : T('女主'), v: localVoiceName(k)
    }), 2600);
    if (SPK.playing) speakJump(0);
  }
  /* slow：等到超时引擎仍没就绪；firstSynth：还没成功合成过（首段要建会话，慢得多） */
  var LOCAL = { ready: false, checking: false, info: null, list: null, miss: 0,
                slow: false, firstSynth: true, lib: false };
  /* health().version 低于这个数，说明是升级前留下的旧语音服务（没有标点/英文修正）。
     桌面壳启动时会按这个号判断要不要把旧服务清掉重起，页面这里只做日志与提示。 */
  var LOCAL_MINVER = 8;
  function localBase() { return 'http://127.0.0.1:' + (Number(CFG.localPort) || 8177); }
  function localReady() { return !!(CFG.localOn && LOCAL.ready); }
  function localErrText(status, txt) {
    if (status === 404) return T('服务路径不匹配，请更新语音包');
    if (status === 503) return T('语音引擎正在初始化，稍后再试');
    /* 502 是桥自己的合成失败，正文里带着引擎给的原因，原样透出去——
       这一层再包一层「HTTP 502」只会把最有用的信息埋掉。 */
    if (status === 502) return String(txt || '').slice(0, 300) || T('神经语音没合成出这一段');
    if (status === 415) return T('这一段是英文，本机没装英文语音模型');
    return 'HTTP ' + status + (txt ? '：' + String(txt).slice(0, 80) : '');
  }
  /* 探测本机语音引擎；服务未启动时静默回退系统语音，不打扰阅读 */
  function localProbe(force) {
    if (LOCAL.checking) return Promise.resolve(LOCAL.ready);
    if (!CFG.localOn) { LOCAL.ready = false; return Promise.resolve(false); }
    LOCAL.checking = true;
    /* 4 秒而不是 2.2 秒：引擎正在解压模型 / 建会话时，CPU 和内存都很紧，
       状态接口偶尔要两三秒才回，超时就等于误判成「没连上」。 */
    return withTimeout(fetch(localBase() + '/health', { method: 'GET', cache: 'no-store' }), 4000)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        LOCAL.ready = !!(j && j.ok); LOCAL.info = j || null; LOCAL.checking = false;
        /* 配角库是不是已经建好会话：库热了就不该再提示「正在准备语音库」 */
        if (j && typeof j.lib !== 'undefined') LOCAL.lib = !!j.lib;
        LOCAL.list = buildVoiceList(j);
        LOCAL.miss = LOCAL.ready ? 0 : LOCAL.miss + 1;
        if (LOCAL.ready) { fixLocalVoice(); fixPinBalance(); fixLead(); fixNarr(); maybeIntro(); }
        /* 连上的是升级前残留的旧引擎？提示一句「重启就好」，
           免得用户以为这一版什么都没改。 */
        if (LOCAL.ready && !speakEnv().android && (j.version || 0) < LOCAL_MINVER && !LOCAL.oldTip) {
          LOCAL.oldTip = 1;
          toast(T('当前连的是旧版语音引擎（标点/英文修正不生效），完全退出墨吟再打开即可换成新版'), 5200);
        }
        fillVoices(); if (force && LOCAL.ready) toast(T('已连接免费离线神经语音（{n} 个声线可用）', { n: localVoiceList().length }), 2600);
        return LOCAL.ready;
      })
      .catch(function () {
        LOCAL.ready = false; LOCAL.info = null; LOCAL.list = null; LOCAL.checking = false; LOCAL.miss++;
        fillVoices();
        // 桌面才讲「启动器」；手机上这句是废话，交给 speakBlocked() 说清楚。
        // 顺带把 Lite 版说出来：它本来就不含语音库，让人去双击启动器是白指路。
        if (force && !speakEnv().android) toast(T('这次没连上离线语音引擎：Lite 版不含语音库，需换完整版；完整版请双击 VoicePack/启动语音引擎.cmd'), 6200);
        return false;
      });
  }
  function localURL(text, voice) {
    return fetch(localBase() + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, voice: voice || CFG.localVoice, speed: Number(CFG.rate) || 1,
        dn: Number(CFG.dnMode) || 0, en: Number(CFG.enVoice) ? 1 : 0 })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        /* 415 = 服务端说「这段是外文，本机没有英文模型」。这时才把 enDead 立起来，
           后续英文块不再白送；60 秒后自动解禁，万一模型这会儿刚好建好还能用上。 */
        if (r.status === 415 || /no_en_voice/.test(t)) enDead = Date.now();
        throw new Error(localErrText(r.status, t));
      });
      enDead = 0;                                  // 这次念出来了，说明英文可用
      return r.blob();
    }).then(function (b) {
      if (!b || b.size < 1000) throw new Error(T('服务返回的音频为空'));
      return URL.createObjectURL(b);
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; rej(new Error(T('请求超时（语音引擎未响应）'))); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); res(v); } },
        function (e) { if (!done) { done = true; clearTimeout(t); rej(e); } });
    });
  }
  /* ---------------- 检查更新 ----------------
     「默认零联网」是这个软件摆在第一位的承诺，所以这里不搞后台偷偷连：
     ① 只有点了「检查更新」才发一次请求，读的是 90 KB 的版本清单，不传任何本机信息；
     ② 「启动时自动检查」默认关闭，要开自己在设置里开，随时能关；
     ③ 清单里带着每个包的大小和 sha256，下载完能自己核对，不怕中间被换包。 */
  var UPD = { busy: false, doc: null, at: 0 };
  /* 版本清单只从 GitHub 自家的两处取：Pages（主）与 raw.githubusercontent（备）。
     不挂任何第三方加速——检查更新可能自动触发，不该悄悄把 IP 交给不相干的人。 */
  var UPD_SRC = [
    'https://podcatcher962.github.io/versions.json',
    'https://raw.githubusercontent.com/podcatcher962/podcatcher962.github.io/main/versions.json'
  ];
  function jsonFetch(url, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('timeout')); }, ms);
      fetch(url, { cache: 'no-store' }).then(function (r) {
        clearTimeout(t);
        if (!r.ok) { rej(new Error('HTTP ' + r.status)); return; }
        r.json().then(res, function () { rej(new Error('bad json')); });
      }, function () { clearTimeout(t); rej(new Error('net')); });
    });
  }
  /* 版本比较：1.9.10 必须大于 1.9.9（按数字比，别按字符串比） */
  function cmpVer(a, b) {
    var pa = String(a || '0').split(/[.+\-]/), pb = String(b || '0').split(/[.+\-]/);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = parseInt(pa[i], 10) || 0, y = parseInt(pb[i], 10) || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }
  /* 这台设备该拿哪个包。桌面壳分不出完整版还是 Lite（页面是同一份），所以 exe 两个都列出来让人选。 */
  function updMine(builds) {
    var e = speakEnv(), p = navigator.platform || '', ua = navigator.userAgent || '';
    var mac = /Mac/i.test(p), lin = /Linux|X11/i.test(p) && !/Android/i.test(ua);
    return (builds || []).filter(function (b) {
      var f = b.file || '';
      if (e.android) return /\.apk$/i.test(f);
      if (e.apk) {
        if (mac) return /\.zip$/i.test(f);
        if (lin) return /\.tar\.gz$/i.test(f) || /\.deb$/i.test(f);
        return /\.exe$/i.test(f);
      }
      return /\.html$/i.test(f);
    });
  }
  function updSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  /* 打开下载地址。安卓壳里 WebView 自己存不了 APK，交给系统浏览器；桌面壳里
     octet-stream 会让 WebView2 走下载而不是跳页，不会把界面顶掉。 */
  function openUrl(u) {
    var e = speakEnv();
    /* 两端原生壳都用 location.href：
       安卓 —— WebViewClient 把站外链接交给系统浏览器，顺带把 APK 下下来；
       桌面 —— 下载链返回 application/octet-stream，WebView2 会走「下载」而不是跳页，
               外壳已开 ALLOW_DOWNLOADS，弹系统保存框。window.open 在这两种壳里都不靠谱
               （WebView 没有 onCreateWindow，pywebview 会开一个空窗口）。 */
    if (e.android || e.apk) {
      try { location.href = u; return; } catch (x) { }
    }
    try { var w = window.open(u, '_blank'); if (w) return; } catch (x) { }
    try { location.href = u; } catch (x) { toast(T('打不开下载页，请复制链接手动打开')); }
  }
  function copyUrl(u) {
    /* copyText 不会 reject，失败时返回 false（老 WebView 没有 clipboard API 走 execCommand） */
    copyText(u).then(function (ok) {
      if (ok === false) { window.prompt(T('复制这个链接到浏览器'), u); return; }
      toast(T('下载链接已复制'));
    });
  }
  function checkUpdate(manual) {
    if (UPD.busy) return;
    UPD.busy = true;
    if (manual) toast(T('正在检查新版本…'), 2000);
    var i = 0;
    var next = function () {
      if (i >= UPD_SRC.length) throw new Error('all sources failed');
      var u = UPD_SRC[i++];
      return jsonFetch(u, manual ? 9000 : 7000).catch(next);   // 上一个源挂了就换下一个
    };
    next().then(function (doc) {
      UPD.busy = false;
      var t = null;
      (doc && doc.tools || []).forEach(function (x) { if (x.id === 'moyin-reader') t = x; });
      if (!t) throw new Error('no entry');
      UPD.doc = t; UPD.at = Date.now();
      if (cmpVer(t.version, VER) <= 0) {
        if (manual) {
          showModal(T('已是最新版本'), '<p>' + esc(T('你用的是 {v}，服务器上也是最新的。', { v: VER })) + '</p>' +
            '<p class="kv">' + esc(T('清单读取于刚才，共收录 {n} 个产物。', { n: (t.builds || []).length })) + '</p>',
            [{ label: T('关闭') }]);
        }
        return;
      }
      showUpdate(t);
    }).catch(function () {
      UPD.busy = false;
      /* 自动检查失败就彻底安静，不打扰读书；手动点才提示 */
      if (manual) showModal(T('检查失败'), '<p>' + esc(T('连不上版本服务器。可能是网络不通，或你现在处于完全离线状态。')) + '</p>' +
        '<p class="kv">' + esc(T('本软件的其它功能都不受影响，随时可以再试。')) + '</p>', [{ label: T('关闭') }]);
    });
  }
  function showUpdate(t) {
    var mine = updMine(t.builds), others = (t.builds || []).filter(function (b) { return mine.indexOf(b) < 0; });
    var btn = function (b, primary) {
      var u = (b.urls && b.urls[0]) ? b.urls[0].u : '';
      return '<button class="updGo' + (primary ? ' pri' : '') + '" data-u="' + esc(u) + '">' +
        esc(b.file) + ' · ' + updSize(b.size) + '</button>';
    };
    var h = '<p style="font-size:1.12em">' + T('有新版本') + ' <b>' + esc(t.version) + '</b>' +
      ' <span class="kv">（' + T('你用的是') + ' ' + esc(VER) + '）</span></p>' +
      '<p class="kv">' + esc(t.name || '') + (t.published ? ' · ' + esc(t.published) : '') + '</p>';
    h += '<h3>' + T('你这台设备') + '</h3><div class="updList">' +
      (mine.length ? mine.map(function (b, i) { return btn(b, i === 0); }).join('')
        : '<p class="kv">' + esc(T('没找到与你设备匹配的包，请从下面的「其它平台」里选。')) + '</p>') + '</div>';
    if (others.length) {
      h += '<details class="updMore"><summary>' + T('其它平台') + '（' + others.length + '）</summary><div class="updList">' +
        others.map(function (b) { return btn(b, false); }).join('') + '</div></details>';
    }
    h += '<p class="kv">' + esc(T('下完先看大小：和上面写的不一样，就是没下完，别急着装。想更稳妥可以比对 sha256。')) + '</p>' +
      '<p class="kv" style="word-break:break-all">sha256 ' + esc(mine.length ? mine[0].sha256 : (t.builds[0] || {}).sha256 || '') + '</p>';
    showModal(T('发现新版本'), h, [
      { label: T('复制链接') },
      { label: T('稍后再说') },
      {
        label: T('去下载'), cls: 'pri', fn: function () {
          var b = mine[0] || (t.builds || [])[0];
          if (b && b.urls && b.urls[0]) { openUrl(b.urls[0].u); closeModal(); }
        }
      }
    ]);
    var mb = $('modalBody');
    mb.onclick = function (e) {
      var el = e.target;
      while (el && el !== mb && !el.getAttribute('data-u')) el = el.parentNode;
      if (el && el !== mb) { e.preventDefault(); openUrl(el.getAttribute('data-u')); closeModal(); }
    };
    var f = $('modalFoot');
    if (f && f.children[0]) f.children[0].onclick = function () {
      var b = mine[0] || (t.builds || [])[0];
      if (b && b.urls && b.urls[0]) copyUrl(b.urls[0].u);
    };
  }
  function revokeURL(u) { if (u && String(u).indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) {} } }
  function stopLocalAudio() {
    if (SPK.audio) {
      try {
        SPK.audio.pause(); SPK.audio.onended = null; SPK.audio.onerror = null;
        revokeURL(SPK.audio.src); SPK.audio.src = '';
      } catch (e) {}
      SPK.audio = null;
    }
  }
  /* 单段合成失败时的处置。
     1.14.28 及以前，安卓分支是「错一次就弹全屏诊断卡 + 停朗读」——把「还没准备好」
     当成「引擎坏了」。而手机上单次失败恰恰是常态：配角库要现解压 51 MB、建 38 MB
     int8 会话，中端机半分钟起步，内存一紧连 ensureLib 都过不去。187 个声音又是
     用户最爱点的地方，于是最想试的功能成了最容易踩弹窗的地方。（真机反馈：
     朗读中换声线偶发无声 + 报错弹窗，退出重进又好了——重进时解压好的文件还在，不用再解。）
     现在按原因分三档，能继续念就继续念：
       slow —— 超时 / 服务端说正在加载：这一句跳过，库热了后面自动接上，只轻提示一次；
       soft —— 这一段没出声（空文本、模型没吐波形、音频坏）：跳过这一句接着念；
       hard —— 库/模型真的起不来（libErr、OOM、采样率=0）：才停下来把自检摆给用户。
     另外连着失败太多次也算 hard——那不是「这一段的事」了。 */
  /* @verify-speak:start —— _verify_speak.js 按这一行切出「失败分级 + 处置」整段代码，
     在 Node 里配着假引擎跑断言。改动这段时别动标记。 */
  var SOFT_FAIL = /empty text|空文本|音频为空|音频加载失败|没有出声|全段没出声|model missing|音色|voice|not found/i;
  /* 真坏了的信号：模型起不来、内存不够、采样率是 0。这些重试也没用，该让人看见原因。 */
  var HARD_FAIL = /sampleRate=0|OutOfMemory|lib: |加载失败|未就绪|引擎不可用|没有中文/;
  /* 还在准备：请求超时、服务端说正在加载/初始化。手机上的失败大半落在这里。 */
  var SLOW_FAIL = /timeout|超时|HTTP 503|正在加载|正在初始化|请稍等|还在准备|lib_loading/;
  function failKind(msg) {
    if (HARD_FAIL.test(msg)) return 'hard';
    if (SLOW_FAIL.test(msg)) return 'slow';
    return 'soft';
  }
  function localFail(msg) {
    msg = String(msg || '');
    /* 415 是「这段是外文，本机没装英文模型」，不是引擎故障。
       必须先于分级判断：手机上更不该为一段英文弹「语音没有出声」。
       但只有整段真的是外文才该交给英文语音；中文书里夹一个英文词被回 415
       （老版本语音包会这样），绝不能把整句中文一起丢掉——先按中文念过去。 */
    if (/^HTTP 415|no_en_voice/.test(msg)) {
      var bad = SPK.chunks[SPK.ci];
      if (hasHan(bad)) { speakZhOnly(); return; }
      speakForeign(bad); return;
    }
    var and = speakEnv().android;
    var kind = failKind(msg);
    /* 「还在准备」不计入 fails：它不是故障。配角库首次加载要跳好几句，
       混进去就会连跳四句凑到阈值，把「正在装」判成「坏了」——那正是要修的病。 */
    if (kind === 'slow') {
      SPK.slowN = (SPK.slowN || 0) + 1;
      /* 但连跳十几句还在准备，就不是准备的事了：把自检摆出来，别再安静跳过。 */
      if (SPK.slowN > 15) {
        SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
        stopLocalAudio();
        if (and) localDiag(msg); else degradeLocal(msg);
        return;
      }
      /* 只在第一次说一声，之后每段都提示等于每段都骚扰。 */
      if (!SPK.slowTold) {
        SPK.slowTold = 1;
        toast(T('语音引擎还在准备，这几句先跳过，好了会自动接上'), 4200);
      }
      skipChunk(msg, true);
      return;
    }
    SPK.fails = (SPK.fails || 0) + 1;
    /* 安卓壳里的系统语音是「哑」的，切过去等于没声音，所以手机端永远不退系统语音。
       但「不能切」只说明那条路不通，不说明整场朗读该停下——连着出不来才算真挂。
       手机给 3 次：配角库首次加载连丢两段是正常的，第三次才算坏。 */
    if (kind === 'hard' || SPK.fails > (and ? 3 : 6)) {
      SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
      stopLocalAudio();
      /* degradeLocal 会提示「双击 VoicePack/启动语音引擎.cmd」——手机上这句是胡说八道，
         而且切过去的系统语音在壳里是哑的，用户会彻底没声音。手机只弹自检卡。 */
      if (and) localDiag(msg); else degradeLocal(msg);
      return;
    }
    if (and || SOFT_FAIL.test(msg)) { skipChunk(msg, kind !== 'soft'); return; }
    /* 桌面端还能问一句 health：能回就只当这一段的事，回不了才是引擎没了。 */
    withTimeout(fetch(localBase() + '/health', { cache: 'no-store' }), 1600)
      .then(function (r) { if (r.ok) skipChunk(msg); else degradeLocal(msg); })
      .catch(function () { degradeLocal(msg); });
  }
  /* @verify-speak:end */
  /* 跳过这一句，接着念下一句。只丢这一句，段里其它内容照念；
     不弹窗、不切系统语音——最多轻提示一次。 */
  function skipChunk(msg, quiet) {
    if (!SPK.playing) return;
    SPK.gen++;                                   // 半路回来的旧结果就此作废
    clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio();
    if (!SPK.skipped && !quiet) {
      SPK.skipped = 1;
      toast(T('这一句没合成出来，已跳过继续朗读（{m}）', { m: String(msg).slice(0, 60) }), 3600);
    }
    speakNext(false);
  }
  /* 这一句明明有中文，却被回「这是外文」——语音包遇到不认识的英文词
     （CPU / macOS / WiFi）会把整句判成外文。把拉丁字母抹掉再念一遍：
     丢一个英文词可以接受，丢一整句中文不行。同一句只试一次，不死循环。 */
  function speakZhOnly() {
    if (!SPK.playing) return;
    var i = SPK.ci, txt = SPK.chunks[i] || '';
    var zh = txt.replace(/[A-Za-z][A-Za-z'\u2019\-]*/g, ' ');
    if (!sayable(zh) || SPK.enDrop === i) { skipChunk(T('这一句只有外文')); return; }
    SPK.enDrop = i;
    if (!SPK.enTold) {
      SPK.enTold = 1;
      toast(T('这句里的英文词本地模型不认识，先按中文念过去'), 3600);
    }
    SPK.chunks[i] = zh;
    localSpeakChunk();
  }
  function degradeLocal(msg) {
    /* 一旦退回系统语音，这一场朗读就保持系统语音，不在半路又切回神经语音：
       同一段话两副嗓子比一直用机械音更难受。下次点朗读会自动再试本地引擎。 */
    SPK.degraded = 1;
    toast(T('本地语音引擎不可用：{m}。本次朗读改用系统语音；再点一次朗读可重试（双击「VoicePack/启动语音引擎.cmd」可恢复）', { m: msg }), 7000);
    LOCAL.ready = false; fillVoices();
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio();
    if (SPK.playing) speakChunk(0);
  }
  /* 合成失败时把引擎自检一起摆出来。真机上「没声音」可能是模型没出声、
     峰值太低、采样率不对或者 JNI 直接报错，页面这边只会看到一句「没合成出来」，
     所以让引擎把自己的检查结果交上来，截图就能定位。 */
  function localDiag(msg) {
    var body = '<p>' + T('这一段没合成出来：{m}', { m: String(msg).slice(0, 200) }) + '</p>' +
      '<pre id="dgTxt" style="white-space:pre-wrap;word-break:break-all;font:12px/1.55 monospace;' +
      'max-height:200px;overflow:auto;margin:10px 0 0;color:#9AA7B4">' + T('正在取引擎自检…') + '</pre>' +
      '<p class="kv">' + T('把这张截图发给作者就能定位。') + '</p>';
    showModal(T('语音没有出声'), body, [
      { label: T('再试一次'), cls: 'pri', fn: function () {
          closeModal(); SPK.connecting = false; SPK.slow = false;
          LOCAL.firstSynth = true; startSpeak();
        } },
      { label: T('关闭') }
    ]);
    withTimeout(fetch(localBase() + '/diag', { cache: 'no-store' }), 20000)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var b = document.getElementById('dgTxt');
        if (b) b.textContent = String(t || '').slice(0, 900);
      })
      .catch(function () {});
  }
  /* 预取队列：按段号存「已请求 / 已备好」的合成结果。
     深度 2 而不是 1 —— 分角色时相邻两句往往换模型（旁白是小雅 22 kHz、对白是
     fanchen 16 kHz），深度 1 恰好卡在换声那一下：上一句都快播完了才轮到合成角色
     那句，听感就是「角色开口前干等」。提前两段排队，换声那句通常在上上句还在播
     时就已经备好。 */
  function localPrefetch(at) {
    if (!localReady()) return;
    var i0 = (at === undefined) ? SPK.ci + 1 : at;
    var ch = BK ? BK.ch : -1;
    var map = SPK.pref || (SPK.pref = {});
    for (var i = i0; i <= i0 + 1; i++) {
      var t = SPK.chunks[i];
      if (!t) break;
      if (!sayable(t)) continue;                    // 纯标点块不用合成，播放时留白
      /* 纯外文块且本机没英文模型：送了只会拿回 415，播放时会走英文语音 */
      if (foreignOnly(t) && !enLocal()) continue;
      var v = SPK.cv[i] || CFG.localVoice;
      var old = map[i];
      if (old && old.ch === ch && old.text === t && old.v === v) continue;   // 已经在做了
      if (old) dropPref(i);
      var item = { ch: ch, text: t, v: v, p: localURL(t, v) };
      map[i] = item;
      item.p.catch(function () { });
    }
    // 已经走过的那几段别把 blob 留在内存里
    Object.keys(map).forEach(function (k) { if (+k < i0 - 1) dropPref(+k); });
  }
  function dropPref(k) {
    var map = SPK.pref, it = map && map[k];
    if (!it) return;
    delete map[k];
    it.p.then(function (u) { revokeURL(u); }, function () { });
  }
  /* 整队作废：停读、跳段、换声线时用。正在播的那段不在这里，见 takePref。 */
  function clearPref() {
    var map = SPK.pref;
    if (map) Object.keys(map).forEach(function (k) { dropPref(+k); });
    // 整段预排的队列一起作废：句号前缀的 blob 留着会白占内存，还会在跳段后
    // 播到「段号对上、内容不对」的旧音频
    SPK.fillGen++;
    clearTimeout(SPK.fillQ); SPK.fillQ = null;
    Object.keys(SPK.pcm).forEach(function (k) {
      var it = SPK.pcm[k];
      delete SPK.pcm[k];
      if (it && it.p) it.p.then(function (u) { revokeURL(u); }, function () {});
    });
    SPK.pre = {};
  }
  /* 摘走某一段：从队列删掉但不 revoke —— 它马上就要播，blob 交给 stopLocalAudio 收。 */
  function takePref(i) {
    var map = SPK.pref, it = map && map[i];
    if (!it) return null;
    delete map[i];
    return it;
  }
  /* 开始朗读时先把配角库叫醒：分角色朗读注定要用 fanchen 那套 16 kHz 模型，
     第一次用要解压 40 MB 再建会话。放在开头几句旁白正在播的时候做，
     第一个角色开口就不用干等十几秒。只叫一次，失败也无所谓（真用到时还会再试）。 */
  /* 开始朗读时先把配角库叫醒：分角色朗读注定要用 fanchen 那套 16 kHz 模型，
     第一次用要解压 40 MB 再建会话。放在开头几句旁白正在播的时候做，
     第一个角色开口就不用干等十几秒。失败也无所谓（真用到时还会再试）。
     force：用户手动点了配角声线（s0…s186）。这时不管有没有开分角色都得叫醒——
     以前只认 CFG.roleOn，结果关掉分角色的人一点配角就是冷启动，
     阻塞几十秒然后超时弹窗，看着像「点了没声音」。
     60 秒内不重复叫：加载失败过要能再试，但别被连点打成一片。 */
  var warmedLib = 0;
  /* 打开一本书就叫一次，让壳在后台把推理会话建起来。
     以前是「应用一启动就建」，于是每次开软件都要白等十几秒——而打开软件的人
     多半只是在书架翻一翻，根本没打算听。挪到「快要听了」这个时刻，真要听的人
     从翻开书到点朗读之间总归要翻两页，那十几秒就藏在这段时间里。
     桌面端的 /warm 是幂等的（只预热常驻实例），多叫一次无害。 */
  var warmedEngine = 0;
  function warmEngine() {
    if (!CFG.localOn) return;
    var now = Date.now();
    if (warmedEngine && now - warmedEngine < 30000) return;
    warmedEngine = now;
    setTimeout(function () {
      try {
        withTimeout(fetch(localBase() + '/warm', { cache: 'no-store' }), 6000)
          .then(function (r) { return r.text(); })
          .catch(function () { });
      } catch (e) { }
    }, 120);
    /* 会话建好之后把界面状态同步一次。启动时的探测早就判过「没有引擎」，
       而那个判断现在只是「还没建」，不代表不可用——不清 miss 的话轮询已经停了。 */
    setTimeout(function () {
      LOCAL.miss = 0;
      if (!LOCAL.ready) localProbe();
    }, 12000);
    /* 首次启动的「挑一个声音」在等引擎就绪：先探一次早的，
       别让人对着书架干等 20 秒才见弹窗 */
    if (!CFG.introRev) setTimeout(function () {
      if (!CFG.introRev && !LOCAL.ready) { LOCAL.miss = 0; localProbe(); }
    }, 5000);
  }
  function warmLib(force, delayMs) {    if (!localReady()) return;
    if (!force && !CFG.roleOn) return;
    var now = Date.now();
    if (warmedLib && now - warmedLib < 60000) return;
    warmedLib = now;
    setTimeout(function () {
      try {
        withTimeout(fetch(localBase() + '/warm?lib=1', { cache: 'no-store' }), 6000)
          .then(function (r) { return r.text(); })
          .catch(function () { });
      } catch (e) { }
    }, delayMs === undefined ? 900 : delayMs);
  }
  /* 英文模型 36 MB，冷启动几十秒。等念到第一句英文才建，那几十秒就是
     「点了朗读，界面在动，耳朵里没声」。所以只要这一章含拉丁字母，开念那一刻
     就让桥在后台把它建起来，压在开头几句中文底下。两分钟内不重复叫。 */
  var warmedEn = 0;
  function warmEn() {
    if (!localReady() || !Number(CFG.enVoice)) return;
    var now = Date.now();
    if (warmedEn && now - warmedEn < 120000) return;
    warmedEn = now;
    setTimeout(function () {
      try {
        withTimeout(fetch(localBase() + '/warm?en=1', { cache: 'no-store' }), 6000)
          .then(function (r) { return r.text(); })
          .catch(function () { });
      } catch (e) { }
    }, 700);
  }
  function localSpeakChunk() {
    var txt = SPK.chunks[SPK.ci];
    if (txt === undefined) { speakNext(true); return; }
    var g = ++SPK.gen;
    var v = SPK.cv[SPK.ci] || CFG.localVoice;
    // 三条来源按优先级取：整段预排的（早就合成好）> 本段两句预取 > 现发请求
    var pm = takePcm(SPK.pi, SPK.ci, txt, v);
    var pf = pm ? null : takePref(SPK.ci);
    stopLocalAudio();
    highlight();
    var p = pm ? pm.p
      : (pf && pf.text === txt && pf.v === v && pf.ch === (BK ? BK.ch : -1)) ? pf.p
      : localURL(txt, v);
    /* 首段要现建推理会话，手机上第一次三十秒以上都有可能；之后每段快得多。
       统一按 30 秒卡会把「第一次」判成失败，所以首段放宽到 90 秒。
       配角库（s0…s186）更重：187 人共用一份 38 MB 模型，第一次还要先把 51 MB
       解压到应用目录，中端手机一分多钟都见过——单独给它 150 秒，别把「正在
       准备」当成「没声音」。 */
    var libVoice = /^s\d+$/.test(v);
    var waitMs = libVoice ? (LOCAL.firstSynth ? 150000 : 90000)
      : (LOCAL.firstSynth ? 90000 : 45000);
    var slowTip = 0;
    /* 只在语音库还没建好的那一次提示：库热了以后每段都弹一次，等于每段都
       骚扰一遍——用户要的是「安静等一句」，不是「被反复告知在等」。 */
    if (libVoice && !LOCAL.lib) {
      slowTip = setTimeout(function () {
        if (g === SPK.gen && SPK.playing) {
          toast(T('第一次用配角声线：正在准备 187 人语音库，大约要半分钟'), 6000);
        }
      }, 5000);
    }
    withTimeout(p, waitMs).then(function (u) {
      if (slowTip) clearTimeout(slowTip);
      if (g !== SPK.gen || !SPK.playing) { revokeURL(u); return; }
      LOCAL.firstSynth = false;
      if (libVoice) LOCAL.lib = true;   // 能出音就说明库已经热了，后面别再提示
      SPK.fails = 0;                    // 念出来了，之前那些失败不再累计
      var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
      SPK.audio = a;
      a.onended = function () { if (g === SPK.gen && SPK.playing) speakNext(false); };
      a.onerror = function () { if (g === SPK.gen) localFail(T('音频加载失败')); };
      try {
        var q = a.play();
        if (q && q.catch) q.catch(function () { if (g === SPK.gen) localFail(T('浏览器阻止了播放，请点一下页面')); });
      } catch (e) { localFail(e.message); return; }
      localPrefetch();
      // 声音已经在播了，后台接着把这一段剩下的、再下一段提前合成好
      fillPara(SPK.pi, SPK.ci + 1);
    }).catch(function (e) {
      if (slowTip) clearTimeout(slowTip);
      if (g === SPK.gen) localFail(e.message || T('请求失败'));
    });
  }
  /* 语音分级：Natural / Neural = 神经网络语音（接近真人）；localService=false = 在线合成 */
  var VOICE_CN = {
    xiaoxiao: '晓晓 · 女声', xiaoyi: '晓伊 · 女声', yunyang: '云扬 · 男声(播报)',
    yunxi: '云希 · 男声', yunjian: '云健 · 男声', yunxia: '云夏 · 男声',
    huihui: '慧慧', kangkang: '康康', yaoyao: '瑶瑶', hanhan: '涵涵', tracy: 'Tracy'
  };
  function isNatural(v) { return /natural|neural/i.test((v && v.name) || ''); }
  function isZh(v) { return /^zh/i.test((v && v.lang) || ''); }
  function voiceKey(v) { return (v && (v.voiceURI || v.name)) || ''; }
  function voiceTier(v) {
    var n = isNatural(v), z = isZh(v), online = v && v.localService === false;
    if (z && n) return 0;
    if (z && online) return 1;
    if (z) return 2;
    if (n) return 3;
    return 4;
  }
  function voiceLabel(v) {
    var nm = (v && v.name) || '', short = '';
    Object.keys(VOICE_CN).forEach(function (k) {
      if (!short && nm.toLowerCase().indexOf(k) >= 0) short = VOICE_CN[k];
    });
    if (!short) short = nm.replace(/\s*Online.*$/i, '').replace(/^Microsoft\s*/i, '').replace(/\s*-\s*.*$/, '').trim() || nm;
    var tag = isNatural(v) ? T('自然') : (v.localService === false ? T('在线') : T('本地'));
    return short + ' · ' + tag + ' · ' + (v.lang || '');
  }
  function bestVoice(vs) {
    var a = vs.slice().sort(function (x, y) {
      var d = voiceTier(x) - voiceTier(y); if (d) return d;
      var ax = /xiaoxiao/i.test(x.name || '') ? 0 : 1, bx = /xiaoxiao/i.test(y.name || '') ? 0 : 1;
      return ax - bx || (x.name || '').localeCompare(y.name || '');
    });
    return a[0] || null;
  }
  function voiceBadge(v) {
    var b = $('spQuality'); if (!b) return;
    if (localReady()) {
      b.textContent = T('● 免费神经语音'); b.className = 'vq good';
      b.title = T('本机 sherpa-onnx 神经语音：完全离线、免费、无需账号。当前音色：{v}。左侧下拉可随时换音色，点这里看说明', { v: localVoiceName(CFG.localVoice) });
      var s = $('spVoice');
      if (s) {
        // 连上本机引擎后下拉不再禁用：精选声线就在这里换，听书时可边听边比
        s.disabled = false;
        s.title = T('本机 {n} 个离线声线，选中即生效（当前：{v}）', { n: localVoiceList().length, v: localVoiceName(CFG.localVoice) });
        var lv = 'local:' + CFG.localVoice;
        if (s.value !== lv && s.querySelector('option[value="' + lv + '"]')) s.value = lv;
      }
      return;
    }
    if ($('spVoice')) { $('spVoice').disabled = false; $('spVoice').title = T('朗读语音'); }
    if (!v) { b.textContent = T('无语音'); b.className = 'vq bad'; return; }
    var n = isNatural(v), on = v.localService === false;
    b.textContent = n ? T('● 自然语音') : (on ? T('● 在线语音') : T('● 本地语音（较机械）'));
    b.className = 'vq ' + (n ? 'good' : (on ? 'mid' : 'bad'));
    b.title = n ? T('神经网络语音：语调接近真人；需联网，朗读文字会发送给语音服务合成。点击看说明')
      : (on ? T('在线合成，需联网。点击看说明') : T('系统本地语音，离线可用但音质较机械。点击看说明'));
  }
  /* 朗读条放什么：
     ① 原版男女主（x0 / c0）固定在上面，不能删——它是默认音色，删了没兜底；
     ② 其余全自由：在设置里挑中的声线自动进「我置顶的」，点 × 就删，存在本机配置里。
        置顶就是设为主角，点哪个名字朗读立刻换成哪个——下拉里的组名也照着这么写。
     ③ 自选位男女各半：20 个 = 10 女 + 10 男。听书时换声线，男女都够用，
        也不会挑着挑着整条全是同一种性别。
     195 个声线不铺在条上，否则下拉拉成一条长龙；要挑去设置里挑。 */
  var PIN_MAX = 20;
  var PIN_PER_GENDER = 10;               // 女声 10 + 男声 10
  var CORE_ALIAS = { x0: 'f0', c0: 'm0' };
  /* 朗读条上只有「原版」男女主不可删——它们是默认兜底，删了朗读就没声。
     音高变体（f1~f3 / m1~m3）、187 个配角库、自己挑的音色，一律自由增删。 */
  function keyNorm(k) { return CORE_ALIAS[k] || k; }
  /* 原版男女主：基干索引 0 的那两个（新引擎 f0 / m0，老引擎 x0 / c0）。 */
  function fixedVoiceKeys() {
    var pool = LOCAL.list || LOCAL_VOICES, has = {}, out = [];
    pool.forEach(function (x) { has[x[0]] = 1; });
    if (has.f0) out.push('f0'); else if (has.x0) out.push('x0');
    if (has.m0) out.push('m0'); else if (has.c0) out.push('c0');
    return out;
  }
  function isFixedVoice(k) {
    if (!k) return false;
    var n = keyNorm(k), f = fixedVoiceKeys();
    for (var i = 0; i < f.length; i++) if (keyNorm(f[i]) === n) return true;
    return false;
  }
  /* 主角声线：f0~f3 / m0~m3（老引擎只有 x0 / c0）。
     x0 与 f0 指向同一份模型、显示名也一样，按名字去重，只留一个。 */
  function coreVoiceKeys() {
    var pool = LOCAL.list || LOCAL_VOICES, seen = {}, out = [];
    pool.forEach(function (x) {
      if (!/^([fm][0-3]|x0|c0)$/.test(x[0])) return;
      var lb = String(x[1]);
      if (seen[lb] !== undefined) {
        if (x[0] === CFG.localVoice) out[out.indexOf(seen[lb])] = x[0];   // 正在用的那个优先留下
        return;
      }
      seen[lb] = x[0]; out.push(x[0]);
    });
    return out;
  }
  function isCoreVoice(k) {
    if (coreVoiceKeys().indexOf(k) >= 0) return true;
    var a = CORE_ALIAS[k];
    return !!(a && coreVoiceKeys().indexOf(a) >= 0);
  }
  /* 声线的性别：优先靠档位前缀判（引擎给的 band 一律以「男声 / 女声」开头）；
     老引擎不报 band 时退回看显示名（「中年男 4」这类名字里都有「男」）。
     童声归女声一侧——只有 2 个，单独开一档反而挤掉正常女声位。 */
  function voiceGender(k) {
    var x = (LOCAL.list || LOCAL_VOICES).filter(function (y) { return y[0] === k; })[0];
    if (!x) return 'f';
    return /男/.test(String(x[2] || '') + String(x[1] || '')) ? 'm' : 'f';
  }
  /* 这个声线还能不能进朗读条：core=主角本来就在 / in=已在 / ok=能加 / full=这个性别满了 */
  function pinSlot(k) {
    if (!k) return 'no';
    if (isFixedVoice(k)) return 'core';
    var a = Array.isArray(CFG.pinVoices) ? CFG.pinVoices : [];
    if (a.indexOf(k) >= 0) return 'in';
    var g = voiceGender(k), n = 0;
    pinKeys().forEach(function (x) { if (voiceGender(x) === g) n++; });
    return n >= PIN_PER_GENDER ? 'full' : 'ok';
  }
  /* 引擎刚连上 / 老配置置顶超过 3+3 时，把多出来的按「靠后的先让位」削平。
     只在真的削了东西时提示一次，平时静默。 */
  function fixPinBalance() {
    var a = Array.isArray(CFG.pinVoices) ? CFG.pinVoices : [];
    var keep = [], nf = 0, nm = 0, dropped = 0;
    a.forEach(function (k) {
      if (typeof k !== 'string' || !k || isFixedVoice(k)) return;   // 只放过两个原版
      if (keep.indexOf(k) >= 0) return;
      var g = voiceGender(k);
      var over = (g === 'm') ? (nm >= PIN_PER_GENDER) : (nf >= PIN_PER_GENDER);
      if (over) { dropped++; return; }
      if (g === 'm') nm++; else nf++;
      keep.push(k);
    });
    if (!dropped) return 0;
    CFG.pinVoices = keep; saveCfg();
    var box = $('pinBox'); if (box) box.innerHTML = pinChips();
    fillVoices();
    toast(T('朗读条最多 {a} 个女声 + {b} 个男声，已自动让出 {n} 个位置（设置里随时能再挑）',
      { a: PIN_PER_GENDER, b: PIN_PER_GENDER, n: dropped }), 4200);
    return dropped;
  }
  function pinKeys() {
    var a = Array.isArray(CFG.pinVoices) ? CFG.pinVoices : (CFG.pinVoices = []);
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var pool = LOCAL.list || LOCAL_VOICES, out = [];
    a.forEach(function (k) {
      if (typeof k !== 'string' || out.indexOf(k) >= 0) return;
      if (isFixedVoice(k)) return;                   // 原版本来就在条上，不占置顶位
      if (av && av[k] === false) return;             // 模型文件不在了：先不显示，但记忆留着
      if (pool.some(function (y) { return y[0] === k; })) out.push(k);
    });
    return out;
  }
  /* 置顶一个声线。主角固定那套不用置顶；已经在置顶里就挪到最后（顺序即优先级）。 */
  function pinVoice(k, quiet) {
    var slot = pinSlot(k);
    if (slot === 'core' || slot === 'no') return false;
    if (slot === 'full') {
      if (!quiet) {
        toast(T('{g}声置顶已满 {n} 个（朗读条男女各半）。先在设置里点 × 让出一个，再挑这个',
          { g: voiceGender(k) === 'm' ? T('男') : T('女'), n: PIN_PER_GENDER }), 3600);
      }
      return false;
    }
    var a = Array.isArray(CFG.pinVoices) ? CFG.pinVoices.slice() : [];
    var i = a.indexOf(k);
    if (i >= 0) a.splice(i, 1);
    a.push(k);
    CFG.pinVoices = a; saveCfg();
    if (!quiet) toast(T('已置顶：{v}（朗读条里，随时可删）', { v: localVoiceName(k) }), 2600);
    return true;
  }
  function unpinVoice(k) {
    var a = Array.isArray(CFG.pinVoices) ? CFG.pinVoices.slice() : [];
    var i = a.indexOf(k);
    if (i < 0) return false;
    a.splice(i, 1); CFG.pinVoices = a; saveCfg();
    var box = $('pinBox'); if (box) box.innerHTML = pinChips();
    fillVoices();
    toast(T('已从置顶移除：{v}', { v: localVoiceName(k) }), 2400);
    return true;
  }
  /* 选一个本机声线：切过去，顺手把它加进朗读条置顶。
     主角固定那套本来就在条上，不算「自选」，不必占一个置顶位。 */
  function pickLocalVoice(k, quiet) {
    if (!k) return false;
    var slot = pinSlot(k), added = false;
    CFG.localVoice = k; CFG.voiceAuto = 0;
    /* 顺手记进「男声旁白 / 女声旁白」那一格：下次换书一键就能回到这条 */
    if (voiceGender(k) === 'm') CFG.narrM = k; else CFG.narrF = k;
    if (slot === 'ok' || slot === 'in') added = pinVoice(k, true);
    saveCfg();
    resetCast();                            // 旁白换了，角色池要重新避开新声线
    voiceBadge(curVoice());
    fillVoices();
    var sel = $('spVoice');
    if (sel && localReady()) sel.value = 'local:' + k;
    var box = $('pinBox'); if (box) box.innerHTML = pinChips();
    /* 配角声线（s0…s186）：库没热的话这一下就是冷启动——解压 51 MB、建 38 MB int8
       会话，中端机半分钟起步。先把预热叫起来，再重念当前段；话说在前面，
       别让用户盯着不动的朗读条以为「点了没反应」。 */
    var isLib = /^s\d+$/.test(k);
    if (isLib) warmLib(true, 0);
    if (SPK.playing) speakJump(0);
    if (!quiet) {
      var msg = T('已切换到 {v}', { v: localVoiceName(k) });
      if (added) msg += T('，并加进了朗读条');
      else if (slot === 'full') {
        msg += T('；朗读条里这个性别已满 {n} 个，没加进去（设置里点 × 让位后再挑）', { n: PIN_PER_GENDER });
      }
      var warming = isLib && !LOCAL.lib;
      if (warming) msg += T('；187 人语音库正在准备，开头一两句可能跳过，好了自动接上');
      toast(msg, warming ? 5600 : (slot === 'full' ? 4200 : 3000));
    }
    return added;
  }
  function pinChips() {
    var chip = function (k, del) {
      return '<button data-pin="' + esc(k) + '"' + (CFG.localVoice === k ? ' class="on"' : '') +
        ' title="' + esc(del ? T('点名字切到这个声线，点 × 从朗读条移除') : T('原版声线，固定不可删')) + '">' +
        esc(T(localVoiceName(k))) +
        (del ? '<b data-unpin="' + esc(k) + '" style="font-weight:400;opacity:.55;padding-left:5px">×</b>' : '') +
        '</button>';
    };
    /* 小标题占满一行（.seg 本来就是 flex-wrap:wrap），把女声/男声分成两段，
       一眼能看出「3 个女 + 3 个男」的配额还剩多少 */
    var head = function (txt) {
      return '<span style="flex:0 0 100%;font-size:12px;opacity:.62;line-height:1.6">' + esc(txt) + '</span>';
    };
    var none = '<span class="kv" style="align-self:center;opacity:.5">' + T('还没挑') + '</span>';
    var core = fixedVoiceKeys(), keys = pinKeys();
    var fem = keys.filter(function (k) { return voiceGender(k) !== 'm'; });
    var mal = keys.filter(function (k) { return voiceGender(k) === 'm'; });
    var html = '';
    if (core.length) {
      html += head(T('原版声线 · 固定 {n} 个（不可删）', { n: core.length })) +
        core.map(function (k) { return chip(k, false); }).join('');
    }
    html += head(T('📌 置顶＝主角 · 女声 {n}/{max}', { n: fem.length, max: PIN_PER_GENDER })) +
      (fem.length ? fem.map(function (k) { return chip(k, true); }).join('') : none);
    html += head(T('📌 置顶＝主角 · 男声 {n}/{max}', { n: mal.length, max: PIN_PER_GENDER })) +
      (mal.length ? mal.map(function (k) { return chip(k, true); }).join('') : none);
    return html;
  }
  function localBarList() {
    var pool = LOCAL.list || LOCAL_VOICES, byKey = {}, out = [], used = {};
    pool.forEach(function (x) { byKey[x[0]] = x; });
    fixedVoiceKeys().forEach(function (k) { used[k] = 1; if (byKey[k]) out.push(byKey[k]); });
    pinKeys().forEach(function (k) { if (!used[k] && byKey[k]) { used[k] = 1; out.push(byKey[k]); } });
    if (CFG.localVoice && !used[CFG.localVoice] && byKey[CFG.localVoice]) out.push(byKey[CFG.localVoice]);
    return out;
  }
  /* 朗读条的分组：主角固定 → 置顶女声 → 置顶男声 →（必要时）正在使用。
     置顶按性别分开列，挑音色时不用在一长串里找男女。 */
  function localBarGroups() {
    var pool = LOCAL.list || LOCAL_VOICES, byKey = {}, out = [], used = [];
    pool.forEach(function (x) { byKey[x[0]] = x; });
    var core = fixedVoiceKeys().filter(function (k) { return byKey[k]; }).map(function (k) {
      used.push(k); return byKey[k];
    });
    if (core.length) out.push([T('⭐ 原版声线 · 固定（{n} 个）', { n: core.length }), core]);
    var pins = pinKeys().filter(function (k) { return byKey[k] && used.indexOf(k) < 0; });
    var fem = pins.filter(function (k) { return voiceGender(k) !== 'm'; });
    var mal = pins.filter(function (k) { return voiceGender(k) === 'm'; });
    if (fem.length) {
      out.push([T('📌 置顶＝主角 · 女声（{n}/{max}）', { n: fem.length, max: PIN_PER_GENDER }),
        fem.map(function (k) { used.push(k); return byKey[k]; })]);
    }
    if (mal.length) {
      out.push([T('📌 置顶＝主角 · 男声（{n}/{max}）', { n: mal.length, max: PIN_PER_GENDER }),
        mal.map(function (k) { used.push(k); return byKey[k]; })]);
    }
    var ck = CFG.localVoice;
    if (ck && byKey[ck] && used.indexOf(ck) < 0) out.push([T('▶ 正在使用'), [byKey[ck]]]);
    return out;
  }
  /* 朗读条里的「设为男主 / 女主」两组候选：当前值排最前，再跟置顶的、精选的。
     只列同性别、且文件还在的；上限 12 个，免得下拉比正文还长。
     全库 187 个不放进来——那去设置页挑，这里只放常用的。 */
  function leadCandList(g) {
    var want = g === 'm' ? 'm' : 'f', out = [], seen = {};
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var pool = LOCAL.list || LOCAL_VOICES, cur = (LOCAL.info && LOCAL.info.curated) || [];
    var push = function (k) {
      if (!k || seen[k] || (av && av[k] === false)) return;
      var x = pool.filter(function (y) { return y[0] === k; })[0];
      if (!x || voiceGender(k) !== want) return;
      seen[k] = 1; out.push(x);
    };
    push(g === 'm' ? CFG.leadM : CFG.leadF);
    pinKeys().forEach(push);
    cur.forEach(push);
    /* 所有声线都能当主角：常用（当前 / 置顶 / 精选）排前面，
       剩下按音高补全，同性别的一条不漏。 */
    pool.forEach(function (x) { push(x[0]); });
    return out;
  }
  function leadOptGroup(g) {
    var all = leadCandList(g);
    if (!all.length) return '';
    var cur = g === 'm' ? CFG.leadM : CFG.leadF;
    var lab = g === 'm'
      ? T('🎙 设为男主声线（现：{v}）', { v: localVoiceName(cur) || T('未定') })
      : T('🎙 设为女主声线（现：{v}）', { v: localVoiceName(cur) || T('未定') });
    var opt = function (x) {
      return '<option value="lead' + g + ':' + x[0] + '">' + esc(T(x[1])) + '</option>';
    };
    /* 前 12 条是当前 / 置顶 / 精选，日常要用的都在这一屏里；剩下同性别的一律可选，
       但折进第二组，免得一拉开就是一百多项把人劝退。组名只报这一组自己的条数，
       别写「全部 152 个」——那会让人以为组里少了一百多条。 */
    var head = all.slice(0, 12), rest = all.slice(12);
    var html = '<optgroup label="' + esc(lab) + '">' + head.map(opt).join('') + '</optgroup>';
    if (rest.length) {
      html += '<optgroup label="' +
        esc(T('⋯ 其余{v}（{n} 个）', { v: g === 'm' ? T('男声') : T('女声'), n: rest.length })) +
        '">' + rest.map(opt).join('') + '</optgroup>';
    }
    return html;
  }
  /* ---------------- 首次启动：挑一个声音 ----------------
     187 个声音一次摊开只会让人关掉。这里按音高从低到高取 10 个，
     每个都能当场试听；挑完就写进配置并置顶，之后不再弹。
     「以后再说」也算走过——弹第二次就是骚扰。 */
  /* 首启弹窗的 20 张卡：从 30 条精选里挑，男女各半、青年占四成、低沉只留一条。
     精选本身的排序基本跟着音高走，但首启不能照抄——那样前八张全是低沉和中年男，
     用户还滑不到女声就把窗口关了。这里手工排：男 9（含青年 4）、女 10（含青年 4）、童 1。 */
  var INTRO_KEYS = ['s124', 's58', 's163', 's156', 's52',
                    's174', 's32', 's148', 's72',
                    's36', 's169', 's13', 's149', 's19', 's165',
                    's129', 's120', 's20', 's185', 's41'];
  var INTRO_TXT = '窗外的雨下得很细，字落在纸上，像脚印落在雪里。';
  function maybeIntro() {
    if (CFG.introRev || !localReady()) return false;
    if ($('introVoice')) return false;                       // 已经摊在屏幕上了
    /* 用户已经进设置页（多半就在挑声音）就别盖他一层：算走过，不再弹 */
    var mb = $('modal');
    if (mb && mb.classList.contains('on')) { CFG.introRev = 1; saveCfg(); return false; }
    /* 完整版有 22 kHz 的主角模型，先把它们摆在最前面——那是这套方案的招牌；
       精简版没有，就只列库里的（按音高从低到高，10 个）。 */
    var core = fixedVoiceKeys(), lib = INTRO_KEYS.filter(voiceUsable);
    /* 完整版把两份 22 kHz 主角摆在最前，再从库里补到 20；精简版 20 个全从库里出 */
    var have = core.length ? core.concat(lib.slice(0, 20 - core.length)) : lib.slice(0, 20);
    if (have.length < 4) return false;
    CFG.introRev = 1; saveCfg();
    showIntroVoice(have);
    return true;
  }
  function showIntroVoice(keys) {
    var old = $('introVoice'); if (old) old.remove();
    var sel = keys.indexOf(CFG.localVoice) >= 0 ? CFG.localVoice : keys[0];
    var cards = keys.map(function (k) {
      var x = (LOCAL.list || LOCAL_VOICES).filter(function (y) { return y[0] === k; })[0] || [];
      var hz = (LOCAL.info && LOCAL.info.f0 && LOCAL.info.f0[k]) || 0;
      return '<div class="ivcard' + (k === sel ? ' on' : '') + '" data-iv="' + esc(k) + '">' +
        '<button class="ivtry" data-ivtry="' + esc(k) + '" title="' + esc(T('听一句')) + '">▶</button>' +
        '<b>' + esc(T(x[1] || k)) + '</b>' +
        '<span>' + (hz ? hz + ' Hz' : esc(T(x[2] || ''))) + '</span>' +
        '</div>';
    }).join('');
    var d = document.createElement('div');
    d.id = 'introVoice'; d.className = 'ivmask';
    d.innerHTML = '<div class="ivbox">' +
      '<h3>' + T('先挑一个朗读的声音') + '</h3>' +
      '<p>' + T('从低沉到清亮，{n} 个男女各档都有，男女青年占四成。点 ▷ 听一句，挑一个就能开始。以后随时能在朗读条最左边的下拉里换。', { n: keys.length }) + '</p>' +
      '<div class="ivgrid">' + cards + '</div>' +
      '<div class="ivfoot">' +
      '<button class="pri" id="ivOk">' + T('就用这个') + '</button>' +
      '<button class="ghost" id="ivSkip">' + T('以后再说') + '</button>' +
      '</div></div>';
    document.body.appendChild(d);
    var chosen = sel, aud = null;
    d.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-ivtry]');
      if (tb) {
        var k = tb.getAttribute('data-ivtry');
        if (aud) { try { aud.pause(); } catch (q) {} revokeURL(aud.src); aud = null; }
        tb.textContent = '…';
        /* 试听走和朗读同一条合成链路，听到的就是真念书的声音 */
        withTimeout(localURL(INTRO_TXT, k), 30000).then(function (u) {
          tb.textContent = '▶';
          aud = new Audio(); aud.src = u; aud.playbackRate = Number(CFG.rate) || 1;
          aud.onended = aud.onerror = function () { revokeURL(u); aud = null; };
          try { var p = aud.play(); if (p && p.catch) p.catch(function () { revokeURL(u); }); }
          catch (q2) { revokeURL(u); }
        }).catch(function (er) { tb.textContent = '▶'; toast(T('试听失败：') + er.message, 4200); });
        return;
      }
      var c = e.target.closest('[data-iv]');
      if (c) {
        chosen = c.getAttribute('data-iv');
        Array.prototype.forEach.call(d.querySelectorAll('.ivcard'), function (n) {
          n.classList.toggle('on', n === c);
        });
        return;
      }
      if (e.target.id === 'ivOk') {
        d.remove();
        pickLocalVoice(chosen, true);
        var box = $('pinBox'); if (box) box.innerHTML = pinChips();
        toast(T('已选定 {v}。在朗读条最左边的下拉里随时能换', { v: localVoiceName(chosen) }), 4200);
        return;
      }
      if (e.target.id === 'ivSkip' || e.target === d) {
        if (aud) { try { aud.pause(); } catch (q3) {} }
        d.remove();
      }
    });
  }

  /* 设置页的主角下拉：全库同性别都能挑——这里是翻库的地方，不设 12 个上限 */
  function leadSelOptions(g) {
    var want = g === 'm' ? 'm' : 'f', cur = (g === 'm' ? CFG.leadM : CFG.leadF);
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var pool = LOCAL.list || LOCAL_VOICES;
    if (!LOCAL.list) pool = LOCAL_VOICES;                 // 引擎没连上：只列兜底那几条
    return pool.filter(function (x) {
      return voiceGender(x[0]) === want && (!av || av[x[0]] !== false);
    }).map(function (x) {
      return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? ' selected' : '') + '>' +
        esc(T(x[1])) + '</option>';
    }).join('');
  }
  /* 朗读条上的「旁白男 / 女」：整本一键换性别，比在置顶列表里一个个找快。
     不打 selected——下拉最终要停回「当前旁白」那一项，用 ✔ 标出正在用的性别就够了。 */
  function narrOptGroup() {
    var cur = voiceGender(CFG.localVoice);
    var one = function (g) {
      var k = g === 'm' ? CFG.narrM : CFG.narrF;
      if (!k) return '';
      var nm = T(localVoiceName(k));
      return '<option value="narr:' + g + '">' +
        (cur === g ? '✔ ' : '') + (g === 'm' ? T('男声') : T('女声')) + '：' + nm + '</option>';
    };
    var body = one('f') + one('m');
    if (!body) return '';
    return '<optgroup label="' + esc(T('🎚 旁白用（整本切换）')) + '">' + body + '</optgroup>';
  }
  function fillVoices() {
    var sel = $('spVoice'), vs = SYN ? (SYN.getVoices() || []) : [];
    var loc = localReady(), html = '';
    // 本机声线直接进朗读条：听书时一键换，不用跳设置页
    if (loc) {
      var groups0 = localBarGroups(), total = voiceStat().total, shown = 0;
      groups0.forEach(function (g) {
        shown += g[1].length;
        html += '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (x) {
          return '<option value="local:' + x[0] + '"' + (x[0] === CFG.localVoice ? ' selected' : '') + '>' +
            esc(T(x[1])) + '</option>';
        }).join('') + '</optgroup>';
      });
      // 条上只能切声线，增删统一去设置页：入口放一个，别让人在两个下拉里各猜一半
      html += narrOptGroup();
      html += leadOptGroup('m') + leadOptGroup('f');
      html += '<optgroup label="' + esc(T('⋯ 更多声线')) + '">' +
        '<option value="__pins">' + esc(T('添加 / 删除置顶声线（去设置）')) + '</option>' +
        (total > shown ? '<option value="__more">' + esc(T('还有 {n} 个声线，去设置里挑', { n: total - shown })) + '</option>' : '') +
        '</optgroup>';
    }
    if (!vs.length) {
      sel.innerHTML = html || '<option value="">' + esc(T('（系统暂无语音）')) + '</option>';
      if (loc) sel.value = 'local:' + CFG.localVoice;
      voiceBadge(null); return;
    }
    var groups = [
      [0, T('⭐ 自然语音 · 接近真人（需联网）')], [1, T('在线语音（需联网）')],
      [2, T('本地语音 · 较机械（离线可用）')], [3, T('其他语言 · 自然语音')], [4, T('其他语言')]
    ];
    groups.forEach(function (g) {
      var arr = vs.filter(function (v) { return voiceTier(v) === g[0]; });
      if (!arr.length) return;
      arr.sort(function (a, b) {
        var ax = /xiaoxiao/i.test(a.name || '') ? 0 : 1, bx = /xiaoxiao/i.test(b.name || '') ? 0 : 1;
        return ax - bx || (a.name || '').localeCompare(b.name || '');
      });
      html += '<optgroup label="' + esc(g[1]) + '">' + arr.map(function (v) {
        return '<option value="' + esc(voiceKey(v)) + '">' + esc(voiceLabel(v)) + '</option>';
      }).join('') + '</optgroup>';
    });
    sel.innerHTML = html;
    // 本机引擎可用时，默认就停在本机声线上；系统语音仍保留在下拉里备选
    if (loc) { sel.value = 'local:' + CFG.localVoice; voiceBadge(null); return; }
    var cur = vs.filter(function (v) { return voiceKey(v) === CFG.voiceURI; })[0] || null;
    // 旧配置停在机械语音时，自动升级到神经语音（用户手动选过则不再干预）
    if (CFG.voiceAuto && cur && isZh(cur) && !isNatural(cur)) {
      var best = bestVoice(vs);
      if (best && isNatural(best) && isZh(best)) {
        cur = best; CFG.voiceURI = voiceKey(best); saveCfg();
        setTimeout(function () { toast(T('已自动切换到更自然的语音：{v}（朗读条可随时更换）', { v: voiceLabel(best).split(' · ')[0] }), 4600); }, 1000);
      }
    }
    if (!cur) { cur = bestVoice(vs); if (cur) { CFG.voiceURI = voiceKey(cur); saveCfg(); } }
    if (cur) sel.value = voiceKey(cur);
    voiceBadge(cur);
  }
  function curVoice() {
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var uri = $('spVoice') ? $('spVoice').value : CFG.voiceURI;
    return vs.filter(function (v) { return voiceKey(v) === uri; })[0] || null;
  }
  /* 这一段到底有没有「念得出来」的字。小说里整段只有标点的块不少：
     “？？？”、“……”、“——”。它们不是空文本，但一个可发音的字都没有，
     送去合成会被引擎判成空文本（HTTP 500 empty text）。
     以前这一下就切回系统朗读，听感上就是「念到问号忽然换了个人」。 */
  function sayable(t) {
    var s = String(t || '');
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) return true;              // 0-9
      if (c >= 65 && c <= 90) return true;              // A-Z
      if (c >= 97 && c <= 122) return true;             // a-z
      if (c >= 0x4e00 && c <= 0x9fff) return true;      // 汉字
      if (c >= 0x3400 && c <= 0x4dbf) return true;
      if (c >= 0xf900 && c <= 0xfaff) return true;
      if (c >= 0xff10 && c <= 0xff19) return true;      // ０-９
      if (c >= 0xff21 && c <= 0xff3a) return true;      // Ａ-Ｚ
      if (c >= 0xff41 && c <= 0xff5a) return true;      // ａ-ｚ
    }
    return false;
  }
  /* 纯符号块的长度就是它该占的停顿：一个问号约 0.2 秒，四个问号近 1 秒。
     这样「？？？」听上去是那个人沉默了一会儿，而不是被跳过去。 */
  function punctPause(t) {
    var n = String(t || '').replace(/\s/g, '').length;
    return Math.round((0.18 + 0.16 * Math.min(4, Math.max(1, n))) * 1000);
  }
  /* 这一段有没有汉字、有没有拉丁字母。中文模型一个英文字母都不认识
     （lexicon 里连 hello / OK 都没有），所以纯外文块必须交给英文语音，
     按中文送去合成只会得到「一个字都没念出来」。 */
  function hasHan(t) {
    return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(t || ''));
  }
  function hasLatin(t) {
    return /[A-Za-z]/.test(String(t || ''));
  }
  function foreignOnly(t) {
    return hasLatin(t) && !hasHan(t);
  }
  /* 本地引擎自己能不能念外文。
     ⚠️ 这里**不能**看 /health 的 en 字段。英文模型是在后台线程里建的：页面一启动
     就探测，那会儿 en 必然 false（模型还在解压/建会话），而 localProbe 之后只在
     「整条引擎没连上」时才重试，于是 info.en 会永远停在 false。
     结果就是 localPrefetch / fillPara 把每个英文块都跳过（它们拿 !enLocal() 当理由），
     播到跟前才现发请求——一句英文要算 5 秒，听感正是「念一句、停半天、跳一大段」。
     现在改成：只有「确实念不了」才判死——收到过 415 / no_en_voice，或用户自己关了
     英文语音。没收到过就一律乐观当可用，反正送了不成就退回留白，不吃亏。 */
  var enDead = 0;
  function enLocal() {
    if (enDead && Date.now() - enDead < 60000) return false;
    if (enDead) enDead = 0;                      // 冷却结束，再给它一次机会
    if (!localReady()) return false;
    if ('enVoice' in CFG && !Number(CFG.enVoice)) return false;
    return true;
  }
  /* ---------------- 数字读法 ----------------
     中文神经语音的词典里一个阿拉伯数字都没有。小雅 / 超文这两份 22 kHz 模型靠
     引擎自带的三条数字规则（date / number / phone.fst）挡住，但 187 人那套配角库
     没有 fst——一遇到数字就整段吞掉，「1934年4月13日」听出来只剩「年月日」。
     号段、时间、金额、百分比在小说里到处都是，与其指望每套模型都配规则，
     不如在页面侧先换成汉字再送进引擎：读出来是什么，跟用哪套声线、
     桌面还是手机、哪个版本都无关，一处改完两边都受益。 */
  var CN_D = '零一二三四五六七八九';
  var CN_U = ['', '十', '百', '千'];
  function cnDigits(s) {                       // 逐位读：一九三四
    var o = '', i;
    for (i = 0; i < String(s).length; i++) o += CN_D.charAt(+String(s).charAt(i));
    return o;
  }
  function cn4(s) {                            // 0–9999 按数值读：一千九百三十四
    var n = String(s).replace(/^0+/, ''), out = '', zero = false, i, d, p;
    if (!n) return '';
    for (i = 0; i < n.length; i++) {
      d = +n.charAt(i); p = n.length - 1 - i;
      if (!d) { zero = true; continue; }
      if (zero && out) out += '零';
      zero = false;
      // 「十二」不念「一十二」，但「一百一十二」里的十要留一
      out += (d === 1 && p === 1 && !out ? '' : CN_D.charAt(d)) + CN_U[p];
    }
    return out;
  }
  function cnNum(s) {                          // 任意长：带 万 / 亿
    s = String(s).replace(/[,\s]/g, '').replace(/^0+(?=\d)/, '');
    if (!s) return '零';
    if (s.length <= 4) return cn4(s) || '零';
    if (s.length <= 8) {
      var hi = s.slice(0, s.length - 4), lo = s.slice(-4), h = cn4(hi), l = cn4(lo);
      if (!l) return h + '万';
      return h + '万' + (lo.charAt(0) === '0' ? '零' : '') + l;
    }
    var yi = s.slice(0, s.length - 8), rest = s.slice(-8);
    var r1 = rest.slice(0, 4), r2 = rest.slice(4), tail = '';
    if (r1 !== '0000') tail += cn4(r1) + '万';
    if (r2 !== '0000') tail += (tail && r2.charAt(0) === '0' ? '零' : '') + cn4(r2);
    return cnNum(yi) + '亿' + tail;
  }
  /* 后面跟这些字的数字按「数值」读（五万元 / 三千人），不按逐位读 */
  var CN_UNIT_AFTER = '元块角毛万亿人岁次倍张条只件个天吨米斤克升分钟秒股手户笔';
  /* 四位里长得像年份的（19xx / 20xx）：后接标点、结尾，或任何不是量词的字，
     都按逐位念。「2026上半年」念「二零二六上半年」；念「两千零二十六上半年」
     是财务报表的读法，不是人话。后接量词的仍按数值：「2026人」是两千零二十六人。 */
  function isYearRead(dg, next) {
    if (dg.length !== 4 || !/^(19|20)\d{2}$/.test(dg)) return false;
    return !next || CN_UNIT_AFTER.indexOf(next) < 0;
  }
  /* ---------------- 符号读法 ----------------
     数字对了，句子还是会跑偏：「-2.08」念成「二点零八」，「>0.05」念成「零点零五」，
     意思正好反了。原因很直接——中文模型的词典里没有这些符号，引擎遇到就跳过。

     一条底线：**常用符号宁可多读，绝不省略**。听书时听见「大于」「负」「美元」
     很正常，而这些符号本身带语义；漏一个可能把意思读反。只有**标点**可以省，
     那是停顿不是语义。排版线（「====」「----」）也不算符号，不念。

     唯一要小心的是「贴不贴数字」：同样的 `-`，在「-2.08」里是负号，
     在「1月5日-29日」里是区间，在「- 列表项」里是项目符号。 */
  function cmpNear(op, off, str) {
    var p = off > 0 ? str.charAt(off - 1) : '',
        n = str.charAt(off + op.length);
    return /[0-9A-Za-z\u4e00-\u9fff]/.test(p) || /[0-9A-Za-z\u4e00-\u9fff]/.test(n);
  }
  function symRead(s) {
    // 全角运算符先归一：＞＜＝＋－ 都是 FFxx - FEE0
    s = s.replace(/[\uff1e\uff1c\uff1d\uff0b\uff0d]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
    // 日期先认：2026-01-05 / 2026/1/5 / 2026.1.5 → 二零二六年一月五日
    s = s.replace(/(\d{4})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{1,2})(?!\d)/g, function (all, y, m, d) {
      if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return all;
      return cnDigits(y) + '年' + cnNum(m) + '月' + cnNum(d) + '日';
    });
    // 只有年月：2026-06
    s = s.replace(/(\d{4})\s*[-\/.]\s*(\d{1,2})(?![\d.\/-])/g, function (all, y, m) {
      if (+m < 1 || +m > 12) return all;
      return cnDigits(y) + '年' + cnNum(m) + '月';
    });
    // 区间：3~5 / 60-52 / 1月5日-29日 / 500-800元
    s = s.replace(/([\d年月日号])\s*[-\u2013\u2014\u2212~\uff5e]\s*(?=\d)/g, '$1到');
    s = s.replace(/([日号])\s*[-\u2013\u2014\u2212~\uff5e]\s*/, '$1到');
    /* 箭头一律念出来，不用停顿糊过去：→ 是「到」，← 是「从」，↑↓ 是升降。
       只有在两侧都是数字时才是区间（3→5 念「三到五」）——那也是「到」，同一条。 */
    s = s.replace(/\s*(?:->|=>|\u2192|\u21d2)\s*/g, '到');
    s = s.replace(/\s*\u2190\s*/g, '从');
    s = s.replace(/\s*\u2191\s*/g, '上升');
    s = s.replace(/\s*\u2193\s*/g, '下降');
    // 负号 / 正号：数值紧前就是符号；「- 列表项」后面是空格，不动
    s = s.replace(/(^|[^\dA-Za-z])[-\u2212](?=\d)/g, '$1负');
    s = s.replace(/(^|[^\dA-Za-z])\+(?=\d)/g, '$1正');
    s = s.replace(/([A-Za-z])\s*[-\u2212]\s*(?=\d)/g, '$1减');    // x-5 是减法，不是负号
    // 乘除：数字之间才是运算符，「**粗体**」这种标记留着给后面删
    s = s.replace(/(\d)\s*[*\u00d7\u2715]\s*(\d)/g, '$1乘$2');
    s = s.replace(/(\d)\s*[\u00f7]\s*(\d)/g, '$1除以$2');
    // 比较符：旁边有字有数就念；「====」这种排版线不念
    s = s.replace(/([0-9A-Za-z\u4e00-\u9fff])\s*=\s*(?=[0-9A-Za-z\u4e00-\u9fff])/g, '$1等于');
    s = s.replace(/>=|<=|\u2265|\u2264|\u2260|\u2248|>|<|=/g, function (all, off, str) {
      if (!cmpNear(all, off, str)) return all;
      var m = {
        '>=': '大于等于', '<=': '小于等于', '\u2265': '大于等于', '\u2264': '小于等于',
        '\u2260': '不等于', '\u2248': '约等于', '>': '大于', '<': '小于', '=': '等于'
      };
      return m[all] || all;
    });
    // 千分号、单位、货币：念不出来的都得换成人话
    s = s.replace(/(\d+(?:\.\d+)?)\s*\u2030/g, '千分之$1');
    s = s.replace(/(\d+(?:\.\d+)?)\s*\u2103/g, '$1摄氏度');
    s = s.replace(/(\d+(?:\.\d+)?)\s*\u00b0\s*[Cc]?/g, '$1度');
    s = s.replace(/\u00b1\s*(?=[\d])/g, '正负');
    /* 金额千分位要一起认，否则「$1,200」只吃掉 1，剩下的「,200」变成「一美元,二百」 */
    s = s.replace(/[\u00a5\uffe5]\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*元?/g, '$1元');
    s = s.replace(/\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:美元)?/g, '$1美元');
    s = s.replace(/\u20ac\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g, '$1欧元');
    s = s.replace(/\u00a3\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g, '$1英镑');
    s = s.replace(/(\d)\s*#/g, '$1号');
    s = s.replace(/&/g, '和');
    // 行首序号：「2. 高频微利」念「二、高频微利」；不是小数（后面没有数字）
    s = s.replace(/(^|\n)\s*(\d{1,2})\s*[.\u3001)）]\s+(?=\S)/g, function (all, lead, n) {
      return lead + cnNum(n) + '\u3001';
    });
    // 竖线在表格里就是分栏的分隔，读成停顿
    s = s.replace(/\s*[\uff5c|]\s*/g, '\uff0c');
    // 剩下的纯排版符号删掉（念不出来，也不带语义）
    return s.replace(/[~\uff5e*#^\u00b0\u2033\u2032]/g, '');
  }
  function numRead(s) {
    s = String(s || '');
    // 全角数字先归一到半角，免得两套模型都不认
    s = s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
    // 符号也要先换：整句没有数字时（「甲 -> 乙」）照样得把箭头念成停顿，
    // 否则早退那一句会把箭头原样送进引擎，等于白撤了一个字
    s = symRead(s);
    if (!/[0-9]/.test(s)) return s;
    // 百分比：「63%」→「百分之六十三」
    s = s.replace(/(\d+(?:\.\d+)?)\s*[%％]/g, function (all, n) {
      return '百分之' + (n.indexOf('.') >= 0
        ? cnNum(n.split('.')[0]) + '点' + cnDigits(n.split('.')[1])
        : cnNum(n));
    });
    // 时刻：「12:30」→「十二点三十分」；不是合法时刻的（比分、章节）原样留给下面的通规则
    s = s.replace(/(\d{1,2}):(\d{2})(?![\d:])/g, function (all, h, m) {
      if (+h > 24 || +m > 59) return all;
      return cnNum(h) + '点' + (+m ? cnNum(m) + '分' : '');
    });
    return s.replace(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g, function (all, ip, dp, off, str) {
      var prev = off > 0 ? str.charAt(off - 1) : '';
      var next = str.charAt(off + all.length);
      // 夹在外文里（MP3 / A4 / COVID19）和版本号（1.14.24 的第二段）不动：那是外文的一部分
      if (/[A-Za-z0-9]/.test(prev) || /[A-Za-z]/.test(next)) return all;
      if (prev === '.' && /\d/.test(str.charAt(off - 2) || '')) return all;
      var dg = ip.replace(/,/g, '');
      if (dp) {
        return (/^\d{1,3}$/.test(dg) ? cnNum(dg) : cnDigits(dg)) + '点' + cnDigits(dp);
      }
      // 年份逐位读：一九三四年 / 二零二六上半年 / 一九九零年代；「90年代」「3年」按数值读
      if (next === '年' && dg.length >= 3) return cnDigits(dg);
      if (isYearRead(dg, next)) return cnDigits(dg);
      // 后接量词的按数值读：五万元、三千人
      if (next && dg.length >= 5 && CN_UNIT_AFTER.indexOf(next) >= 0) return cnNum(dg);
      // 整千整万整亿（10000 / 100000000）按数值读，别读成一串零
      if (/^[1-9]0{4,}$/.test(dg)) return cnNum(dg);
      // 号段、身份证、ISBN 这类长数字逐位读，按数值读没人听得懂
      if (dg.length >= 7) return cnDigits(dg);
      if (/^0\d/.test(dg)) return cnDigits(dg);         // 007 这种前导零逐位
      // 量词前的 2 念「两」：两个孩子 / 两次 / 两天，念「二个」是书面的怪味
      if (dg === '2' && next && '个只条张次天岁倍件位名'.indexOf(next) >= 0) return '两';
      return cnNum(dg);
    });
  }
  /* 文本规范化：去掉零宽符、汉字间排版空格、重复标点；保留引号破折号供语音自行处理停顿 */
  function normSpeak(text) {
    var s = String(text || '');
    s = s.replace(/[\u200b-\u200f\ufeff\u00ad]/g, '');
    s = s.replace(/[\t\r\n\u3000]+/g, ' ');
    s = s.replace(/([\u4e00-\u9fff\u3400-\u4dbf])\s+(?=[\u4e00-\u9fff\u3400-\u4dbf])/g, '$1');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/([。！？!?；;，,、：:…])\1+/g, '$1');
    // 只删纯排版标记：* # ~ | ^ 这些可能带语义（乘号、号、区间、分栏），交给 numRead 换人话
    s = s.replace(/[_`]/g, '');
    s = numRead(s);
    return s.trim();
  }
  /* 按完整句子切分后再合并成不超过 maxLen 的朗读块，避免从句中间硬切破坏语调 */
  function splitSpeak(text, maxLen) {
    var M = Math.max(14, maxLen || 60), s = normSpeak(text), out = [], parts = [], buf = '';
    if (!s) return out;
    /* 英文和中文要用两套切分规则。
       以前英文也走中文那套：句子只认「。！？!?；;…」，英文句号 . 不在里面，
       整段英文就被当成一个巨型句子，再按 30 字硬切——每刀都落在单词中间，
       切出 "This is a senten" + "ce that goes on" 这种。模型遇到半个词会吐静音，
       服务端返回空，页面判失败；连续两次失败就熔断掉英文，于是后面的英文整段跳过。
       听起来正是「念一行 → 静一下 → 跳掉一大段 → 再念一行」。
       现在英文按 . ! ? ; : 分句、按 , 分小句，最后按空格累加，永不劈词。 */
    var isEn = !/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(s) && /[A-Za-z]/.test(s);
    var sen = isEn
      ? (s.match(/[^.!?;:\n]+[.!?;:]*|[.!?;:]+/g) || [s])
      : (s.match(/[^。！？!?；;…]+[。！？!?；;…]*|[。！？!?；;…]+/g) || [s]);
    sen.forEach(function (x) {
      if (!x) return;
      if (x.length <= M) { parts.push(x); return; }
      var sub = isEn
        ? (x.match(/[^,;:]+[,;:]?/g) || [x])
        : (x.match(/[^，,、：:]+[，,、：:]?/g) || [x]);
      var b2 = '';
      sub.forEach(function (y) {
        if (b2.length + y.length > M && b2) { parts.push(b2); b2 = ''; }
        while (y.length > M) {
          if (b2) { parts.push(b2); b2 = ''; }
          /* 优先在空格处断，绝不把单词劈成两半（劈了就是静音） */
          var cutAt = isEn ? y.lastIndexOf(' ', M) : -1;
          if (cutAt < Math.floor(M * 0.4)) cutAt = M;
          parts.push(y.slice(0, cutAt));
          y = y.slice(cutAt).replace(/^\s+/, '');
        }
        b2 += y;
      });
      if (b2) parts.push(b2);
    });
    parts.forEach(function (p) {
      p = p.trim(); if (!p) return;
      if (buf && buf.length + p.length > M) { out.push(buf); buf = ''; }
      buf += p;
    });
    if (buf) out.push(buf);
    return out;
  }
  /* ---------------- 分角色朗读 ----------------
     把一段正文切成「旁白」与「引号里的对白」两种片段：旁白用用户选的声线，
     对白按人物固定分配不同声线——同一个人物整本书都是同一个声音。
     认人靠中文小说最常见的「某某说道：」句式；认不出人名时按出场顺序轮换，
     所以即使全都认不出，对话也不会和旁白混成一个声音。 */
  /* 说话动词。中文小说的花样比想象中多：「续道」「接话」「嗤笑」「喃喃自语」…
     漏一个就是一个人物被当成旁白，所以宁可写全。长词排前面，正则交替按顺序匹配。 */
  var SPEAK_VERB = '续道|接着说|接口|接话|插话|插嘴|追问|反问|回应|应道|答道|应声|补充|解释|提醒|承认|否认|'
    + '嘀咕|嘟囔|喃喃|低语|自语|失笑|嗤笑|冷笑|苦笑|笑道|哭道|骂道|喝道|喊道|叫道|吼道|嚷道|'
    + '说|道|问|答|喊|叫|笑|骂|吼|嚷|开口|回答|问道|沉声|轻声|低声道|开口道';
  var NAME_STOP = /^(?:他|她|它|我|你|大家|众人|两人|二人|一人|有人|对方|那人|这人|此时|这时|于是|接着|然后|突然|忽然|连忙|急忙|赶紧|立刻|随后|最后|终于|不禁|忍不住|一面|一边|这话|说完|说完话|听了|闻言|见状|心想|心中|心里)$/;
  /* 名字和动词之间常常隔着一层状语：「女子**平静**回应」「赵长河**忽然**开口」。
     不把这层剥掉，取到的名字就会变成「女子平静」「赵长河忽然」——认人全废。
     单字副词也收进来，因为「张三便道」「李四又问道」比「道」常见得多。 */
  var ADV_SRC = '忽然|突然|蓦地|猛地|慢慢|缓缓|轻轻|淡淡|冷冷|平静|平静地|沉声|低声|轻声|柔声|笑着|冷笑着|'
    + '苦笑|嗤笑|失笑|连忙|急忙|赶紧|随即|接着|顿了顿|顿了一下|沉默片刻|沉默半晌|想了想|沉吟|点头|摇头|'
    + '叹气|皱眉|挑眉|撇嘴|续|又|便|就|才|也|都|却|竟|更|忙|再|方|这才|终于|还是|只是';
  /* 人称与称谓：一眼能定性的先定下来，剩下靠「用字」和上下文代词兜。 */
  var FEMALE_HINT = /女|妈|母|姐妹|奶|婆|姑|姨|嫂|婶|娘|妇|太太|夫人|姑娘|小姐|丫头|少女|女子|女士|女孩|媳妇|大姐|阿姨|婆婆|奶奶|外婆|妈妈|姐姐|妹妹/;
  var MALE_HINT = /男|爸|父|哥|弟|爷|叔|伯|舅|兄|先生|老爷|少爷|公子|老头|汉子|小伙|大哥|大爷|壮汉|汉子|爸爸|爷爷|叔叔|伯伯|舅舅|哥哥|弟弟/;
  /* 中文名字里能看出性别的常用字。名字本身不带「男女」二字，
     但「阿芳」「王丽」这种几乎不会安在男角色身上——按用字投票比瞎猜准得多。 */
  var FEMALE_CHAR = /[芳娟丽娜婷静琳雅薇莉梅兰霞琴颖洁慧燕玲雪月彩淑贞娥姝嫣婉妍媛娇婕妮倩怡欣蕊莹琦瑶荷莲菊蓉萍芹芬芸嘉柔曼妙秀茜彤凤娥萍霞娣妍嫔妃媚娴婉珠玉珍珊瑾璐]/;
  /* 「长河」「青山」「川」「岳」这类名字里的字几乎只出现在男角色身上。
     赵长河这种三字名，全书都抓不到「他」，只能靠用字先定个性别——
     定错了顶多是声音偏一点，不定就被分到女声池里，一开口就是女声，最刺耳。 */
  var MALE_CHAR = /[强伟军勇刚峰磊涛斌亮杰浩宇鹏龙虎彪鑫凯健豪毅锋超明辉宏波威武雄飞振国建志海山林石铁钢柱栋梁啸程长河川江岳岩松柏森栋元伯仲叔季甫侯仁义礼智信忠孝乾坤阳明晨旭帆舟航远行生成立定安平康泰宁丰茂盛兴隆民崇峻峥嵘钧铭锐铮磊雄]/;
  /* 对白音色池里额外补的男声：精选里男声够用，这里再留几个低沉男声备选 */
  /* 精选之外再补的几个低沉男声：角色多的时候男声不至于不够用 */
  var EXTRA_MALE = ['s100', 's119', 's40', 's163', 's98', 's175'];

  /* ---------------- 人物表：先定人，再开口 ----------------
     以前是「谁先开口，谁就从声线池里挑一个还没被用过的」。听起来合理，实际最糟：
     同一个人在不同段落被认成不同写法（赵长河 / 他 / 赵长河忽），各抢一个声音；
     认不出说话人的那句又再抢一个。于是一段两人对话里，男声女声来回跳。
     现在反过来：开口之前先把这一章（连同前后各两章）里说过话的人全扫一遍，
     按出场次数排好，一次性把声线定死，并写进书里（BK.meta.cast），下次打开还是这些声音。
     之后无论遇到「他」「她」还是没写主的对白，都只会绑到已经定好的人物身上。 */
  var CAST_MAX = 14;           // 一本书最多给多少人单独配声；再多必然撞声，不如并回旁白
  var CASTTX = {};             // 章节正文缓存：换章补人物时不必反复解压 / 去标签
  function castWindowText(ch, span) {
    if (!BK || typeof BK.chapterText !== 'function') return '';
    var s = [], from = Math.max(0, ch - (span || 2)), to = Math.min(chapterCount() - 1, ch + (span || 2));
    if (Object.keys(CASTTX).length > 24) CASTTX = {};      // 听了几十章的缓存清一下，别一直往上堆
    for (var i = from; i <= to; i++) {
      var t = CASTTX[i];
      if (t === undefined) {
        try { t = BK.chapterText(i) || ''; } catch (e) { t = ''; }
        CASTTX[i] = t;
      }
      s.push(t);
    }
    return s.join('\n');
  }
  /* 名字后面常粘着状语：「赵长河忽然开口」贪心取 3 字会得到「赵长河忽」。
     状语首字都是一个有限集合，剥到不像状语为止。 */
  var ADV_TAIL = /[忽突蓦猛慢缓轻淡冷平沉低柔笑苦嗤失连急赶随接顿想点摇叹皱挑撇续又便就才也都却竟更忙再方终还只]$/;
  /* 被当成名字抓上来的常用词：「你跟任何人说」「昨天不是说」里的「任何人」「天不是」。
     名字里基本不会出现虚词和代词，先用一条黑名单把它们清掉，免得白占一条声线。 */
  var NAME_BAD = /[不没的是了着过很也就都又还再才更最和与及或但而个这那我你他她们吗呢吧啊]/;
  var NAME_BAD_HEAD = /^(?:任何|所有|其他|别的|别人|自己|大家|众人|有人|没有|什么|怎么|为何|因为|所以|如果|虽然|只是|于是|接着|然后|突然|忽然|此时|这时|一边|一面)/;
  function nameOk(nm) {
    if (!nm || nm.length < 2 || nm.length > 4) return false;
    if (NAME_STOP.test(nm) || NAME_BAD.test(nm) || NAME_BAD_HEAD.test(nm)) return false;
    if (new RegExp('^(?:' + ADV_SRC + ')$').test(nm)) return false;
    return true;
  }
  function castNames(text) {
    var hit = {}, A = '(?:' + ADV_SRC + ')*', V = '(?:' + SPEAK_VERB + ')';
    var pats = [
      new RegExp('([\\u4e00-\\u9fa5]{2,3})' + A + V + '(?:道|说|着)?[：:，,。]', 'g'),
      new RegExp('([\\u4e00-\\u9fa5]{2,4})(?:对|向|跟|朝)[\\u4e00-\\u9fa5]{1,4}' + V, 'g')
    ];
    pats.forEach(function (re) {
      var m;
      while ((m = re.exec(text))) {
        var nm = m[1];
        while (nm.length > 2 && ADV_TAIL.test(nm)) nm = nm.slice(0, -1);   // 剥掉粘上来的状语
        if (!nameOk(nm)) continue;
        hit[nm] = (hit[nm] || 0) + 1;
      }
    });
    var out = [];
    Object.keys(hit).forEach(function (nm) {
      var c = text.split(nm).length - 1;                   // 全书提及次数 ≈ 戏份
      if (c < 2) return;                                   // 只出现一次的，多半是误抓
      out.push({ n: nm, c: c });
    });
    out.sort(function (a, b) { return b.c - a.c || b.n.length - a.n.length; });
    return out;
  }
  function buildCast(ch) {
    if (!CFG.roleOn || !localReady() || !BK) return 0;
    var c = (ch === undefined || ch === null) ? (BK.ch | 0) : ch;
    if (SPK.castAt === c + '|' + CFG.localVoice) return 0;   // 这一段已经排过，别每句都重扫
    var text = castWindowText(c, 2);
    /* 第一次读这本书时，把开篇三章也扫进来：主角几乎一定在前三章露过面，
       这样即使从第 50 章开始听，主角一开口用的也是「主角那个声音」，不会因为
       没在附近出场而被排到后面的次要声线去。 */
    if (!BK.meta || !BK.meta.cast || !Object.keys(BK.meta.cast).length) {
      if (c > 2) text = castWindowText(0, 2) + '\n' + text;
    }
    if (!text) return 0;
    var list = castNames(text);
    if (!list.length) return 0;
    // 先把性别扫一遍：代词就在名字附近，一次扫完，后面配声才不会配反
    list.slice(0, CAST_MAX * 2).forEach(function (it) {
      var i = -1, guard = 0;
      while ((i = text.indexOf(it.n, i + 1)) >= 0 && guard++ < 40) {
        learnSex(it.n, text, i, text.slice(i + it.n.length));
      }
    });
    // 戏份最多的先配：好的声线留给主角，后面的角色分剩下的，整本不再变动
    list.slice(0, CAST_MAX).forEach(function (it) {
      var g = genderOf(it.n);
      if (g === 'f' && !SPK.main.f) SPK.main.f = it.n;
      if (g === 'm' && !SPK.main.m) SPK.main.m = it.n;
      if (!SPK.cast[it.n]) castVoice(it.n);
    });
    SPK.castAt = c + '|' + CFG.localVoice;
    if (BK.meta) { BK.meta.cast = SPK.cast; BK.meta.sex = SPK.sex; savePos(); }
    return list.length;
  }
  /* 打开书时把上次定好的声线接回来：同一本书第二次听，人物声音一模一样 */
  function loadCast(meta) {
    if (!meta) return;
    var all = {}, list = LOCAL.list || LOCAL_VOICES;
    list.forEach(function (x) { all[x[0]] = 1; });
    SPK.cast = {}; SPK.used = {}; SPK.castName = {};
    var c = meta.cast || {};
    Object.keys(c).forEach(function (k) {
      if (!all[c[k]]) return;                    // 语音包换过，旧声线编号可能已经不存在
      SPK.cast[k] = c[k];
      SPK.used[c[k]] = (SPK.used[c[k]] || 0) + 1;
    });
    if (meta.sex) SPK.sex = meta.sex;
    SPK.main = { f: '', m: '' };
    // 主要男女从旧的配音表里恢复：先认戏份，认不出就按已有声线挡着
    Object.keys(SPK.cast).forEach(function (k) {
      var g = genderOf(k);
      if (g === 'f' && !SPK.main.f) SPK.main.f = k;
      if (g === 'm' && !SPK.main.m) SPK.main.m = k;
    });
  }
  function sceneName(g) {
    var s = SPK.scene || {}, m = SPK.main || {};
    return (g === 'f' ? (s.f || m.f) : (s.m || m.m)) || '';
  }
  /* 代词「他/她」先在本段里找最近的同性别名字，找不到再用这一场的在场人物 */
  function nearName(text, at, g) {
    var best = '', bi = -1, aft = '', ai = 1e9;
    Object.keys(SPK.cast || {}).forEach(function (nm) {
      if (!nm || nm.charAt(0) === '?') return;
      if (genderOf(nm) !== g) return;
      var i = text.lastIndexOf(nm, at);
      if (i >= 0 && i > bi) { bi = i; best = nm; }
      var j = text.indexOf(nm, at);
      if (j >= 0 && j < ai) { ai = j; aft = nm; }
    });
    if (best) return best;
    if (aft && ai - at <= 24) return aft;        // 「……」赵长河说：紧跟引号后面那种
    return '';
  }
  function bindWho(who, full, at) {
    if (!who || who === '我') return who;
    if (who === '他' || who === '她') {
      var g = who === '他' ? 'm' : 'f';
      return nearName(full, at, g) || sceneName(g) || who;
    }
    return who;
  }

  function speakerOf(full, at, after) {
    var pre = full.slice(Math.max(0, at - 26), at).replace(/[\s\n]+/g, '');
    var V = '(' + SPEAK_VERB + ')';
    // ① 「张三对俞猴子说」：先认「对 / 跟 / 向 / 朝」，这类里紧贴动词的那个人是听话人，不是说话人
    //    听话人允许只有 1 个字：「张三对她说」里的「她」最常见，用 {2,4} 会整条匹配不上，
    //    于是掉到 ② 把「她」当成说话人——男角色一开口就是女声，正是最容易被听出来的错。
    var toM = pre.match(new RegExp('([\\u4e00-\\u9fa5]{2,4})(?:对|跟|向|朝)([\\u4e00-\\u9fa5]{1,4})(?:' + SPEAK_VERB + ')'));
    if (toM && !NAME_STOP.test(toM[1])) return toM[1].slice(-3);
    // ② 主语在句子里（允许中间隔逗号和动作）：「他盯我一眼，说：」「我气喘吁吁跑进去…说：」
    var subj = '';
    var sm = pre.match(new RegExp('(我|他|她)(?![们])[^。！？]{0,16}?' + V));
    if (sm) subj = sm[1];
    if (subj) return subj;
    // ③ 人名 +（状语）+ 动词：「俞猴子说：」「女子平静回应：」「赵长河忽然开口：」
    //    {2,3}? 用非贪婪：先把名字按最短算，多出来的交给状语。不这样，
    //    「张三便道」会被截成「张三便」，名字错一次，整本书这个人的声线都错。
    var m = pre.match(new RegExp('([\\u4e00-\\u9fa5]{2,3}?)(?:(?:' + ADV_SRC + '))*(?:'
      + SPEAK_VERB + ')(?:道|说|着)?[：:，,]?$'));
    if (m && !NAME_STOP.test(m[1]) && !(new RegExp('^(?:' + ADV_SRC + ')$')).test(m[1])) return m[1];
    // ④ 引号后紧跟「她/他」：中文小说里最常见的主语后置
    var post = String(after || '').replace(/^[\s\u3000]+/, '').slice(0, 24);
    var pm = post.match(/^([他她])(?![们])/);
    if (pm) return pm[1];
    // ⑤ 「女子头也不抬，似是早已知道他的到来：」——主语在最前面，冒号前全是神态和动作。
    //    只认称谓（女子/老头/少年…）和已经见过的名字，不然「他看着窗外：」会被当成
    //    「他看着」这么个人。②③都没认出来才走这里，所以不会把「张三说」带偏。
    if (/[：:]$/.test(pre)) {
      var head = pre.slice(-26);
      var nm2 = head.slice(0, 2), nm3 = head.slice(0, 3);
      // 先试 2 字：「女子头也不抬」里的「女子」是称谓，取 3 字会变成「女子头」
      if (FEMALE_HINT.test(nm2) || MALE_HINT.test(nm2) || SPK.cast[nm2] || SPK.sex[nm2]) return nm2;
      if (FEMALE_HINT.test(nm3) || MALE_HINT.test(nm3) || SPK.cast[nm3] || SPK.sex[nm3]) return nm3;
    }
    // ⑥ 引号后是「某某放下报纸，慢慢问道」：名字锚在开头，动词可隔几个字
    //    3 字只在「名字紧贴动词」时采用，避免把「老人放下」当成名字
    var cand = [];
    [2, 3].forEach(function (L) {
      var nm = post.slice(0, L);
      if (nm.length < L || /[^\u4e00-\u9fa5]/.test(nm) || NAME_STOP.test(nm)) return;
      var rest = post.slice(L, L + 16);
      var vm = rest.match(new RegExp('^[^。！？]{0,12}?(?:(?:' + ADV_SRC + '))*(?:' + SPEAK_VERB + ')'));
      if (vm) cand.push({ nm: nm, gap: vm[0].length, len: L });
    });
    if (!cand.length) return '';
    // 「女子平静回应」里 two=「女子」是称谓，three=「女子平」是称谓＋状语的一半，
    // 这种时候必须取 2 字。只有「赵长河忽然开口」这种 2 字认不出的才用 3 字。
    var two = cand.filter(function (x) { return x.len === 2; })[0];
    var three = cand.filter(function (x) { return x.len === 3 && x.gap <= 8; })[0];
    if (two && (FEMALE_HINT.test(two.nm) || MALE_HINT.test(two.nm)
      || SPK.cast[two.nm] || SPK.sex[two.nm])) return two.nm;
    return (three || two || cand[0]).nm;
  }
  /* 把一段切成 [{t: 文本, role: 'narr'|'say', who: 人名}] */
  function roleSegments(text) {
    var out = [], last = 0, m;
    var re = /「([^」]{0,400})」|『([^』]{0,400})』|“([^”]{0,400})”|"([^"]{0,400})"/g;
    while ((m = re.exec(text))) {
      var inner = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
      var before = text.slice(last, m.index);
      if (before.trim()) out.push({ t: before, role: 'narr' });
      if (inner && inner.trim()) {
        var after = text.slice(m.index + m[0].length);
        /* 代词「他/她」在这里就换成具体人物，别让它作为一个「新人物」去占一条声线。
           以前「她」和「女子」各配一个女声，同一段里一个人两种嗓子，就是这么来的。 */
        var who = bindWho(speakerOf(text, m.index, after), text, m.index);
        learnSex(who, text, m.index, after);       // 顺手把「他是男是女」记下来
        out.push({ t: inner, role: 'say', who: who });
        // 这一场谁在场：代词和无名对白都靠它接住
        if (who && who !== '我' && who !== '他' && who !== '她') {
          var wg = genderOf(who);
          if (wg === 'f') SPK.scene.f = who; else if (wg === 'm') SPK.scene.m = who;
          SPK.scene.lastWho = who;
        }
      }
      last = m.index + m[0].length;
    }
    var tail = text.slice(last);
    if (tail.trim() || !out.length) out.push({ t: tail || text, role: 'narr' });
    /* 对白交替推断（最后一道兜底）：一问一答的小说里，没写是谁说的那对引号，
       几乎总是换个人在说。只在「上一句有明确归属 + 两句之间几乎没有旁白 +
       本句也短」时才敢这么判——把一段独白硬拆成两个人，比不换声更难受。
       换成的是**已经定好声线的那个对手**，不是凭空再配一个「男声二号」。 */
    // 上一段最后开口的人：单句成段的对话（「你连拐杖都没有，忽悠谁呢。」）
    // 全靠它才知道该换谁——否则每段都从「无人」起算，永远接不上。
    var prev = (SPK.scene && SPK.scene.lastWho) ? { role: 'say', who: SPK.scene.lastWho } : null;
    for (var i = 0; i < out.length; i++) {
      var s = out[i];
      if (s.role !== 'say') continue;
      if (!s.who && prev && prev.who) {
        var gapLen = 0;
        for (var j = i - 1; j >= 0 && out[j].role === 'narr'; j--) gapLen += out[j].t.length;
        if (gapLen <= 4 && s.t.length <= 42) {
          var pg = genderOf(prev.who);
          var mate = pg === 'f' ? sceneName('m') : pg === 'm' ? sceneName('f') : '';
          if (mate && mate !== prev.who) { s.who = mate; s.guess = 1; }
        }
      }
      prev = s;
    }
    /* 旁白里紧贴着对白的那一小截，本来就是说话人的动作：
       「女子平静回应：」「赵长河忽然开口。」。用旁白声念，会在一个人说话中间
       硬插进另一个嗓子，听起来就是「声线不停变」。短句且有相邻对白时跟着那个人走：
       以冒号/逗号收尾的，是引出下一句对白；以句号收尾的，是给上一句对白收尾。 */
    for (i = 0; i < out.length; i++) {
      var nb = out[i];
      if (nb.role !== 'narr') continue;
      var tx = String(nb.t || '').replace(/\s+$/, '');
      var leadIn = /[：:，,]$/.test(tx);
      /* 只有「说话动作」才跟着角色走：带说话动词（道/说/问/回应/开口…）或引到对白的冒号。
         纯动作描写（「她抬头看了一眼窗外。」）仍归旁白——那是叙述者的声音，
         不该被塞进任何一个角色的嗓子里。 */
      var speechy = new RegExp('(?:' + SPEAK_VERB + ')').test(tx);
      if (!leadIn && !speechy) continue;
      if (tx.length > (leadIn ? 30 : 16)) continue;
      var nx = out[i + 1], pv = out[i - 1];
      var nxw = (nx && nx.role === 'say') ? nx.who : '';
      var pvw = (pv && pv.role === 'say') ? pv.who : '';
      /* 承接下一句的，用下一句的人；下一句没写主（「她合上账本，“……”」），
         就用上一句那位——这两个本来就是同一个人。 */
      if (leadIn) nb.vWho = nxw || pvw;
      else nb.vWho = pvw || nxw;
    }
    return out;
  }
  function genderOf(who) {
    if (!who) return '';
    if (who === '他') return 'm';
    if (who === '她') return 'f';
    /* 「?m / ?f」是交替推断出来的「没点名的那位」：一段对白谁也认不出是谁说的，
       但上一句明明是女声，按一问一答的常态这一句就该换个人。整本书只给它
       一个固定声线，不会每句乱跳。 */
    if (who.charAt(0) === '?') return who.charAt(1) === 'f' ? 'f' : 'm';
    if (SPK.sex && SPK.sex[who]) return SPK.sex[who];      // 上文认出来的最可靠
    if (FEMALE_HINT.test(who)) return 'f';
    if (MALE_HINT.test(who)) return 'm';
    var fc = (who.match(FEMALE_CHAR) || []).length;
    var mc = (who.match(MALE_CHAR) || []).length;
    if (fc > mc) return 'f';
    if (mc > fc) return 'm';
    return '';
  }
  /* 从上下文认性别：中文小说里人名几乎不自带性别，但代词每段都有。
     「张三冷笑一声，他没有马上回答」这种一抓一个准，引号后紧跟「他/她」也极常见。
     认一次就记进 SPK.sex，整本书都按同一个判断——不会这一段男声、下一段又变女声。 */
  function learnSex(who, full, at, after) {
    if (!who || who === '他' || who === '她' || who === '我' || who.charAt(0) === '?') return;
    /* 「女子」「老头」这类称谓本身就把性别写清楚了，再拿代词去「学」只会学坏：
       「女子头也不抬，似是早已知道他的到来」里的「他」指的是对面那个人。 */
    if (FEMALE_HINT.test(who)) { SPK.sex[who] = 'f'; return; }
    if (MALE_HINT.test(who)) { SPK.sex[who] = 'm'; return; }
    if (SPK.sex[who]) return;
    var post = String(after || '').replace(/^[\s\u3000]+/, '');
    var pm = post.match(/^([他她])(?![们])/);
    if (pm) { SPK.sex[who] = pm[1] === '他' ? 'm' : 'f'; return; }
    var pre = String(full.slice(0, at)).slice(-46).replace(/[\s\u3000]+/g, '');
    var i = pre.lastIndexOf(who);
    if (i < 0) return;
    var seg = pre.slice(i + who.length, i + who.length + 16);
    // 只认「，他/她」这种主语位置的代词：「张三对她说」里的她是听话人，不能算
    var cm = seg.match(/[，,、][^，,。！？]{0,6}?([他她])(?![们])/);
    if (cm) SPK.sex[who] = cm[1] === '他' ? 'm' : 'f';
  }
  /* 候选声线：精选那 21 个快声线；按「男女混合 / 全女声 / 全男声」过滤。
     只有用户主动打开「角色用全库声线」才允许动用 187 人那套慢库——那套一句二十字要十几秒，
     自动扩进去会让角色一多就开始干等，跟 1.14.8 的速度目标正好相悖。
     注意：这里看的是 roleWide，不是「声线范围」。后者只管下拉里列什么，1.14.23 起默认「全部」，
     如果拿它当开关，所有人一分角色就会掉进慢库。 */
  function rolePool(gender) {
    var all = LOCAL.list || LOCAL_VOICES, band = {};
    all.forEach(function (x) { band[x[0]] = x[2] || ''; });
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var wide = Number(CFG.roleWide) === 1;
    var keys = cur.length ? cur.slice() : all.map(function (x) { return x[0]; });
    if (wide) {
      EXTRA_MALE.forEach(function (k) { if (band[k] !== undefined && keys.indexOf(k) < 0) keys.push(k); });
      /* 人物比手头的声线还多时，自动扩到全部声线：
         书里几十号人也不至于挤在几个声音上（旁白那个声线仍然避开） */
      var used = Object.keys(SPK.cast || {}).length;
      if (used >= keys.length && all.length > keys.length) keys = all.map(function (x) { return x[0]; });
    }
    var want = CFG.rolePool || 'mix';
    if (want === 'mix') want = (gender === 'm' ? 'male' : gender === 'f' ? 'female' : 'mix');
    return keys.filter(function (k) {
      if (k === CFG.localVoice) return false;
      /* 男女主那两条留给他们自己，别的角色不许抢 */
      if (k === CFG.leadM || k === CFG.leadF) return false;
      var male = String(band[k] || '').indexOf('男声') === 0;
      if (want === 'male') return male;
      if (want === 'female') return !male;
      return true;
    });
  }
  /* 音色属于哪一档（「男声 · 中年」「女声 · 青年」…），用来核对配上的声音对不对性别 */
  function voiceBand(k) {
    var all = LOCAL.list || LOCAL_VOICES;
    for (var i = 0; i < all.length; i++) if (all[i][0] === k) return all[i][2] || '';
    return '';
  }
  /* 给一个人物挑声音：先按性别过滤，再挑「被用得最少」的那个，保证几个人物声音不撞 */
  function castVoice(who) {
    /* 「我说」＝旁白在说话。第一人称书里说话的人就是念旁白那个人，
       换成别的声线等于书里凭空多出一个人，最容易让人搞不清谁在开口。 */
    if (who === '我') {
      if (SPK.scene) { SPK.scene.lastV = CFG.localVoice; SPK.scene.lastWho = who; }
      return CFG.localVoice;
    }
    /* 认不出是谁的那一句：沿用上一位的声音。
       以前这里会从池子里挑「用得最少」的那个——于是一段对话里每句换一个嗓子，
       男声女声来回跳，正是最刺耳的听感。宁可少换，也不能乱换。 */
    if (!who) return (SPK.scene && SPK.scene.lastV) || CFG.localVoice;
    var g = genderOf(who);
    var key = SPK.cast[who];
    if (key && g) {
      /* 先前没认出性别、随手配了一个；后来从上下文认出来了。
         配上的声音跟性别对不上就换掉——宁可换一次，也不能让男角色一直用女声。 */
      var band = voiceBand(key);
      if (band && ((g === 'm') !== /^男/.test(band))) {
        if (SPK.castName[key] === who) delete SPK.castName[key];
        delete SPK.cast[who];
        key = '';
      }
    }
    var pool = rolePool(g), out = key || '', lead = leadFor(who, g);
    if (!out && lead) {
      /* 男女主：直接用主角那条声线，不参与角色池的「谁用得最少」竞争。
         池子里已经排除了这两条，所以别的角色不会跟主角撞声。 */
      out = lead;
      SPK.cast[who] = lead;
      if (who.charAt(0) !== '?') SPK.castName[lead] = who;
      SPK.used[lead] = (SPK.used[lead] || 0) + 1;
    } else if (!pool.length) out = CFG.localVoice;
    else if (!out) {
      var pick = pool[0], best = 1e9;
      pool.forEach(function (k) { var c = SPK.used[k] || 0; if (c < best) { best = c; pick = k; } });
      out = pick;
      SPK.cast[who] = pick;
      if (who.charAt(0) !== '?') SPK.castName[pick] = who;
      SPK.used[pick] = (SPK.used[pick] || 0) + 1;
    }
    // 记住这一场是谁在说话：代词与无名对白都靠它接住，不再另配新声
    if (SPK.scene) {
      if (out !== CFG.localVoice) SPK.scene.lastV = out;
      if (who !== '他' && who !== '她' && who.charAt(0) !== '?') {
        if (g === 'f') SPK.scene.f = who; else if (g === 'm') SPK.scene.m = who;
        SPK.scene.lastWho = who;
      }
    }
    return out;
  }
  function resetCast() {
    SPK.cast = {}; SPK.used = {}; SPK.castName = {}; SPK.sex = {};
    SPK.scene = { f: '', m: '', lastWho: '', lastV: '' }; SPK.main = { f: '', m: '' }; SPK.castAt = '';
    SPK.pre = {};          // 预排结果里存的是旧声线，必须一起作废
    CASTTX = {};           // 换书 / 换声线后重新取正文
  }
  function roleLabel() {
    if (!CFG.roleOn) return '';
    if (!localReady()) return '';
    return T('多角色');
  }

  function onlineFallback() {
    if (SPK.fb) return false;
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var local = vs.filter(function (v) { return isZh(v) && v.localService !== false; })[0];
    if (!local) return false;
    SPK.fb = 1; CFG.voiceURI = voiceKey(local); CFG.voiceAuto = 0; saveCfg();
    if ($('spVoice')) $('spVoice').value = CFG.voiceURI;
    voiceBadge(local);
    toast(T('在线自然语音连接失败，已自动切回本地语音（联网恢复后可在语音下拉里重新选）'), 5200);
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    try { SYN.cancel(); } catch (e) {}
    if (SPK.playing) speakChunk(0);
    return true;
  }
  function highlight() {
    $('page').querySelectorAll('.rdp.speaking').forEach(function (e) { e.classList.remove('speaking'); });
    var p = SPK.paras[SPK.pi];
    if (p) {
      p.classList.add('speaking');
      if (CFG.follow) revealPara(p, true);
    }
    var t = (SPK.chunks[SPK.ci] || '').slice(0, 46);
    var who = '';
    if (CFG.roleOn && localReady() && SPK.cv[SPK.ci] && SPK.cv[SPK.ci] !== CFG.localVoice) {
      var nm = SPK.castName[SPK.cv[SPK.ci]] || T('对白');
      who = '<b class="spwho">' + esc(nm) + '</b>';
    }
    $('spNow').innerHTML = '<span class="spdot"></span>' + who + esc(t);
  }
  /* 纯外文块（一个汉字都没有、只有英文字母）：中文模型念不出来。
     按优先顺序走三条路，都不能算「引擎故障」：
       ① 装了英文模型的本地引擎 —— 照常走神经语音（服务端自己会分派英文模型）；
       ② 系统里有英文语音 —— 用它念这一块。语言换了，声音本来就不该是同一副；
       ③ 两条都没有 —— 按这段字该念多久留白，然后继续往下念，只轻提示一次。
     以前这里会 500 -> 「本地语音引擎不可用」-> 整场退回机械音，
     一本书里只要有一段英文信就毁掉整章听感，是最冤的一种降级。 */
  var FOREIGN_TIP = 0;
  function englishVoice() {
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var en = vs.filter(function (v) { return /^en/i.test(v.lang || ''); });
    if (!en.length) return null;
    en.sort(function (a, b) {
      // 本地语音优先：英文块本来就短，不值得为它去联网
      var al = a.localService === false ? 1 : 0, bl = b.localService === false ? 1 : 0;
      if (al !== bl) return al - bl;
      return (isNatural(a) ? 0 : 1) - (isNatural(b) ? 0 : 1);
    });
    return en[0];
  }
  function skipForeign(txt) {
    if (!SPK.playing) return;
    SPK.gen++;
    clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio();
    if (!FOREIGN_TIP) {
      FOREIGN_TIP = 1;
      toast(T('这一段是英文，本机没有英文语音，按语速留白后继续往下念'), 4200);
    }
    // 留白长度按字母数估（约每 6 个字符 0.5 秒），最长 4.5 秒
    var w = Math.min(4500, Math.max(500,
      Math.round(String(txt || '').replace(/\s/g, '').length * 85)));
    SPK.ci++;
    if (SPK.ci < SPK.chunks.length) { speakChunk(w); return; }
    speakNext(true);
  }
  function speakForeign(txt) {
    var v = SYN ? englishVoice() : null;
    if (!v) { skipForeign(txt); return; }
    var g = ++SPK.gen;
    stopLocalAudio();
    highlight();
    var u = new UTT(txt);
    u.voice = v; u.lang = v.lang || 'en-US';
    u.rate = Math.min(1.5, Math.max(0.6, (Number(CFG.rate) || 1) * 0.95));
    u.pitch = 1; u.volume = Number(CFG.volume);
    u.onend = function () {
      if (g !== SPK.gen || !SPK.playing) return;
      clearTimeout(SPK.watch); speakNext(false);
    };
    u.onerror = function () {
      if (g !== SPK.gen || !SPK.playing) return;
      clearTimeout(SPK.watch);
      // 英文语音自己出错（没装语音包 / 系统拒绝）也别当引擎坏了，留白过去
      skipForeign(txt);
    };
    try { SYN.speak(u); } catch (e) { skipForeign(txt); return; }
    clearTimeout(SPK.watch);
    SPK.watch = setTimeout(function () {
      if (g !== SPK.gen || !SPK.playing) return;
      try { SYN.cancel(); } catch (e) {}
      skipForeign(txt);
    }, Math.max(6000, Math.min(30000, String(txt).length * 260 + 4000)));
  }
  function speakChunk(delay) {
    if (!SPK.playing) return;
    /* 纯标点块：本来就没有字可念，按它的长度留一段安静就走。
       既不发合成请求（服务端会回 empty text），也不会被误判成引擎坏了。 */
    var head = SPK.chunks[SPK.ci];
    if (head !== undefined && !sayable(head)) {
      SPK.ci++;
      var w = punctPause(head);
      if (SPK.ci < SPK.chunks.length) { speakChunk(Math.max(Number(delay) || 0, w)); return; }
      speakNext(true); return;
    }
    /* 纯外文块：有英文模型的本地引擎能念，其余的交给英文语音 / 留白。 */
    if (head !== undefined && foreignOnly(head) && !(enLocal() && !SPK.degraded)) {
      return speakForeign(head);
    }
    // 句间 / 段间留白：神经网络语音靠完整句子产生语调，句与句之间留一点静默更接近真人
    if (delay > 0) {
      clearTimeout(SPK.gapT);
      SPK.gapT = setTimeout(function () { if (SPK.playing) speakChunk(0); }, delay);
      return;
    }
    if (localReady() && !SPK.degraded) return localSpeakChunk();
    if (!SYN || !UTT) return;
    var txt = SPK.chunks[SPK.ci];
    if (txt === undefined) { speakNext(true); return; }
    var g = ++SPK.gen;
    var u = new UTT(txt), v = curVoice(), online = v && v.localService === false;
    if (v) { u.voice = v; u.lang = v.lang; }
    else u.lang = 'zh-CN';
    u.rate = Number(CFG.rate); u.pitch = Number(CFG.pitch); u.volume = Number(CFG.volume);
    u.onend = function () { if (g !== SPK.gen) return; SPK.seenEnd = true; clearTimeout(SPK.watch); speakNext(false); };
    u.onerror = function () {
      if (g !== SPK.gen) return; clearTimeout(SPK.watch);
      if (online && onlineFallback()) return;
      speakNext(false);
    };
    highlight();
    try { SYN.speak(u); } catch (e) { toast(T('朗读启动失败：') + e.message); stopSpeak(false); return; }
    // 长文本静默停止看门狗：按字数 + 语速动态估算，在线语音额外预留合成时间
    clearTimeout(SPK.watch);
    var est = Math.max(7000, Math.min(34000,
      txt.length * 340 / (Number(CFG.rate) || 1) + (online ? 5500 : 2500)));
    SPK.watch = setTimeout(function () {
      if (g !== SPK.gen || !SPK.playing) return;
      try { SYN.cancel(); } catch (e) {}
      if (online && !SPK.seenEnd && onlineFallback()) return;
      speakNext(false);
    }, est);
  }
  function speakNext(auto) {
    if (!SPK.playing) return;
    SPK.ci++;
    // 句内的停顿已经由语音引擎按标点分层插好了（逗号 0.38 秒 / 句号 0.75 秒，
    // 见 VoicePack/tts_server.py 的 PAUSE 表），这里只留一丝缝隙，
    // 不然跟引擎的句末停顿叠起来就变成两倍长。
    if (SPK.ci < SPK.chunks.length) { speakChunk(Math.min(60, Number(CFG.pause) || 0)); return; }
    SPK.pi++;
    if (SPK.pi >= SPK.paras.length) {
      if (CFG.autoNext && BK && BK.ch < chapterCount() - 1) {
        renderChapter(BK.ch + 1, { fromSpeak: true });
        SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
        SPK.pi = 0; setPara(0); speakChunk(0); return;
      }
      stopSpeak(false); toast(T('朗读结束')); return;
    }
    setPara(SPK.pi);
    // 换段先把这一段排进合成队列，别等播到第一句才发请求
    if (localReady()) fillPara(SPK.pi, 0);
    speakChunk(Math.min(700, (Number(CFG.pause) || 0) * 2));
  }
  /* ---------------- 整段预排（跨段预取） ----------------
     换段时最难受的不是「合成慢」，而是「这一段播完了才开始合成下一段」。
     一段十几句的旁白，常驻引擎也要 2~3 秒，而它播放要十几秒——
     只要在播这一段的时候就把下一段排好，换段就是无缝的。
     所以这里做两件事：
       ① prefPara(pi) 先把某一段的「句子 + 声线」算出来（纯计算，几毫秒）。
          提前算还有个副作用正好是想要的：人物的声线在那时就定死了，
          播到那儿不会再临时换人。算完存下，setPara 直接复用。
       ② fillPara(pi) 按句子顺序一句一句送去合成，结果按「段号:句号」存，
          播放时 localSpeakChunk 直接取现成的，不用等。
     串行而不是一起发：同一时刻只让一个合成请求占着引擎，正在播的那句
     才不会被一堆预取挤到后面（实测并发发 8 条，第一条反而慢一倍）。 */
  function pcmKey(pi, ci) { return pi + ':' + ci; }
  function chunkMax(text) {
    // 与 setPara 完全同一套口径：换段数和预演必须算出同样的句子，否则缓存对不上
    var natural = localReady() || isNatural(curVoice());
    var M = CFG.whole ? (natural ? 90 : 42) : 30;
    /* 英文的字符密度只有中文三分之一左右：30 字只够五六个词，翻页似的切，
       每块都要付一次完整的合成启动开销（建 context、解码、重采样）。
       实测同一句话切成 9 块要 63 秒，放开到整句只要 20 秒出头。按 1.8 倍放宽，
       前提是这一段没有汉字——中英混排的段落仍按中文口径走。 */
    if (text && !/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text) && /[A-Za-z]/.test(text))
      M = Math.round(M * 1.8);
    return Math.round(M * Math.min(1, Number(CFG.rate) || 1));
  }
  function prefPara(pi, M) {
    var p = SPK.paras[pi];
    if (!p) return null;
    var text = p.textContent || '';
    /* 长度按这一段自己的语言算，不信调用方传进来的那个（它不知道这段是什么语言） */
    M = Math.max(16, chunkMax(text));
    var k = (CFG.roleOn ? 'r' : 's') + '|' + CFG.localVoice + '|' + M + '|' + text;
    var it = SPK.pre[pi];
    if (it && it.k === k) return it;
    var out = { k: k, ch: [], cv: [] };
    if (CFG.roleOn && localReady()) {
      roleSegments(text).forEach(function (seg) {
        var v = seg.role === 'say' ? castVoice(seg.who)
          : (seg.vWho ? castVoice(seg.vWho) : CFG.localVoice);
        splitSpeak(seg.t, M).forEach(function (t) { out.ch.push(t); out.cv.push(v); });
      });
    }
    if (!out.ch.length) {
      out.ch = splitSpeak(text, M);
      out.cv = out.ch.map(function () { return CFG.localVoice; });
    }
    SPK.pre[pi] = out;
    return out;
  }
  function dropPcm(pi) {
    Object.keys(SPK.pcm).forEach(function (k) {
      if (+k.split(':')[0] !== pi) return;
      var it = SPK.pcm[k];
      delete SPK.pcm[k];
      if (it && it.p) it.p.then(function (u) { revokeURL(u); }, function () {});
    });
  }
  var AHEAD = 3;                 // 提前排几段：短句（「对。」）一秒就播完，只排下一段来不及
  function fillPara(pi, at) {
    if (!localReady()) return;
    var g = ++SPK.fillGen;
    var beg = pi, from = at || 0, idx = from;
    function step() {
      if (g !== SPK.fillGen) return;
      var it = SPK.pre[pi];
      if (!it) return;
      // 纯标点块不送去合成（引擎没字可念），播放时按长度留白；
      // 纯外文块在本机没英文模型时也一样——送了只会反复拿回 415
      while (idx < it.ch.length && (SPK.pcm[pcmKey(pi, idx)] || !sayable(it.ch[idx]) ||
             (foreignOnly(it.ch[idx]) && !enLocal()))) idx++;
      if (idx >= it.ch.length) {
        // 这一段排完了，接着排下一段（最多提前 AHEAD 段）
        if (pi + 1 < SPK.paras.length && (pi + 1) - SPK.pi < AHEAD) {
          pi++; idx = 0;
          prefPara(pi, chunkMax());
          if (!SPK.pre[pi]) return;
          SPK.fillQ = setTimeout(step, 0);
        }
        return;
      }
      var ci = idx, key = pcmKey(pi, ci);
      var item = { text: it.ch[ci], v: it.cv[ci] };
      SPK.pcm[key] = item;
      item.p = localURL(item.text, item.v);
      var okp = function () { SPK.fillQ = setTimeout(step, 0); };
      item.p.then(function (u) { item.u = u; okp(); },
        function () { delete SPK.pcm[key]; SPK.fillQ = setTimeout(step, 900); });
    }
    step();
  }
  function takePcm(pi, ci, text, v) {
    var k = pcmKey(pi, ci), it = SPK.pcm[k];
    if (!it || it.text !== text || it.v !== v) return null;
    delete SPK.pcm[k];                 // 马上要播，blob 交给 stopLocalAudio 收
    return it;
  }
  function setPara(i) {
    SPK.pi = Math.max(0, Math.min(SPK.paras.length - 1, i));
    // 分段表换成这一段：句子与声线走 prefPara，播到这儿时通常已经预演过了
    var it = prefPara(SPK.pi, chunkMax());
    SPK.chunks = it ? it.ch.slice() : [];
    SPK.cv = it ? it.cv.slice() : [];
    SPK.ci = 0;
    // 记住「听到哪」，下次可从书架一键续听（与「读到哪」分开记，互不打扰）
    if (BK && BK.meta && SPK.on) {
      BK.meta.lCh = BK.ch; BK.meta.lPi = SPK.pi; savePos();
    }
  }
  var TRY_TEXT = '窗外的雨下得很细，字落在纸上，像脚印落在雪里。他合上书，听见声音还留在屋里，没有立刻散去。';
  /* 精简试验包：包里不带 22 kHz 的小雅 / 超文两份主角模型。
     帮助页里写着「三份模型」的那些话得跟着改口，否则用户下拉里找不到主角会以为坏了。 */
  function isLite() { return !!(LOCAL.info && LOCAL.info.lite); }
  /* 模型里到底有多少声音、男女各多少：设置页文案直接用它，别写死数字 */
  function voiceStat() {
    var all = LOCAL.list || LOCAL_VOICES;
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    // x0 / c0 是主角专用的单说话人模型（22.05 kHz），不算在 187 个配角说话人里
    var lib = all.filter(function (x) { return x[0] !== 'x0' && x[0] !== 'c0'; });
    var male = lib.filter(function (x) { return String(x[2] || '').indexOf('男声') === 0; }).length;
    return { total: all.length, lib: lib.length,
             female: lib.length - male, male: male,
             curated: cur.length || LOCAL_VOICES.length };
  }
  /* 朗读设置页上的「这本书的角色」：不点朗读也能看到认出几个人、用掉几个声线。
     以前这行数字混在一大段说明里，还要先开朗读才有值，等于白写。 */
  function castStatTx() {
    if (!BK) return T('打开一本书后这里显示认出了几个人物');
    var cast = (SPK.cast && Object.keys(SPK.cast).length) ? SPK.cast : ((BK.meta && BK.meta.cast) || {});
    var names = Object.keys(cast);
    if (!names.length) return T('还没识别（点「识别一遍」，或直接开始朗读）');
    var vs = {}, f = 0, m = 0;
    names.forEach(function (nm) {
      var k = cast[nm];
      if (!k) return;
      vs[k] = 1;
      if (voiceGender(k) === 'm') m++; else f++;
    });
    return T('{n} 个角色 · 用掉 {v} 个声线（女 {f} / 男 {m}）', {
      n: names.length, v: Object.keys(vs).length, f: f, m: m });
  }
  function syncRoleBtn() {
    var b = $('spRole'); if (!b) return;
    var ready = localReady();
    b.classList.toggle('on', !!CFG.roleOn && ready);
    // 引擎没连上时要一眼看出「为什么没换声」，别让人以为功能坏了
    b.textContent = CFG.roleOn ? (ready ? T('多角色') : T('需语音引擎')) : T('单声线');
    b.title = !ready
      ? T('分角色朗读需要本机神经语音引擎：完整版首次启动会自动准备；Lite 版双击「VoicePack/启动语音引擎.cmd」。系统语音只能发出一个声音。')
      : CFG.roleOn
        ? T('分角色朗读已开启：旁白用当前声线，引号里的对白按人物换声。点击关闭')
        : T('分角色朗读：对话自动换声（旁白保持当前声线）。点击开启');
  }
  function toggleRole() {
    if (!localReady()) {
      toast(T('分角色朗读需要本机神经语音（系统语音只能出一个声音）：先双击「VoicePack/启动语音引擎.cmd」'), 6200);
      return;
    }
    CFG.roleOn = CFG.roleOn ? 0 : 1; CFG.roleTouched = 1; saveCfg(); syncRoleBtn(); resetCast();
    // 刚打开的这本书，先把人物声线一次配齐，再开念
    if (CFG.roleOn && BK && localReady()) buildCast(BK.ch);
    if (SPK.playing) speakJump(0);
    else if (SPK.on) setPara(SPK.pi);
    if (CFG.roleOn) warmLib();
    toast(CFG.roleOn ? T('分角色朗读已开启：旁白照旧，对白按人物换声') : T('已回到单一声音'), 3000);
  }
  var ROLE_TRY = '他把伞靠在门边，抖了抖上面的水。“外面雨真大。”她抬头看了一眼，又说：“今晚就别走了。”';
  /* 试听分角色：旁白 + 两句不同人物对白，挨个念一遍，听完就知道效果 */
  function tryRole() {
    if (!localReady()) { toast(T('分角色试听需要本机神经语音：先双击「VoicePack/启动语音引擎.cmd」'), 5600); return; }
    if (SPK.playing) stopSpeak(false);
    var keepCast = SPK.cast, keepUsed = SPK.used;
    SPK.cast = {}; SPK.used = {};
    var jobs = [];
    roleSegments(ROLE_TRY).forEach(function (s) {
      jobs.push({ t: s.t, v: s.role === 'say' ? castVoice(s.who) : CFG.localVoice });
    });
    SPK.cast = keepCast; SPK.used = keepUsed;
    toast(T('分角色试听：旁白 + {n} 句对白，声音各不相同', { n: Math.max(0, jobs.length - 1) }), 3400);
    var i = 0;
    (function next() {
      if (i >= jobs.length) return;
      var j = jobs[i++];
      withTimeout(localURL(j.t, j.v), 30000).then(function (u) {
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        a.onended = a.onerror = function () { revokeURL(u); next(); };
        try { var q = a.play(); if (q && q.catch) q.catch(function () { revokeURL(u); }); }
        catch (e) { revokeURL(u); }
      }).catch(function (e) { toast(T('试听失败：') + e.message, 5200); });
    })();
  }
  /* ── 朗读不可用时，按平台给不同的出路 ───────────────────────────────
     桌面：换浏览器；安卓浏览器：装 APK；APK 内：去系统装中文语音。
     在手机上甩一句「请用新版 Edge / Chrome」等于什么都没说。 */
  /* 下载走本站的下载页，不是直接甩一个 70 MB 的包：
     Pages 不适合长期托管这么大的二进制（每次发版都要整包同步到 CDN，会超时），
     由下载页列出官方直链与可选的第三方加速，让用户自己决定把 IP 交给谁。 */
  var APK_URL = 'https://podcatcher962.github.io/moyin-reader/download/';
  function speakEnv() {
    var ua = navigator.userAgent || '', host = location.hostname || '';
    return {
      android: /Android/i.test(ua),
      ios: /iPhone|iPad|iPod/i.test(ua),
      inApp: /MicroMessenger|QQ\/|Weibo|DingTalk/i.test(ua),
      apk: host === '127.0.0.1' || host === 'localhost',
      sys: !!(SYN && UTT)
    };
  }
  /* ---------------- 语音故障诊断 ----------------
     起因：小米用户反馈「按提示设置过了还是不行」，而截图通常截不到最关键的那一行，
     来回问三四轮才能定位。这段纯文本把三件事一次说清：
       ① 系统里到底有没有中文语音包（读 speechSynthesis.getVoices，这是最有说服力的证据）
       ② 装的是哪个包（安卓 APK / 桌面 / 网页），本地神经语音有没有就绪
       ③ 引擎自检原文 + 机型屏幕内存，便于判断是不是被省电策略掐掉
     不含任何阅读内容与账号信息，只有设备与引擎状态。 */
  function diagPack() {
    var e = speakEnv();
    if (e.android && e.apk) return T('安卓版（APK）');
    if (e.android) return T('手机浏览器网页版');
    if (/^file:/.test(location.protocol)) return T('桌面版（本地文件）');
    return T('桌面 / 网页版');
  }
  function sysVoices() {
    var vs = (SYN && SYN.getVoices) ? SYN.getVoices() : [];
    var zh = vs.filter(function (v) {
      return /^(zh|cmn)|chinese|中文|普通话|mandarin/i.test((v.lang || '') + ' ' + (v.name || ''));
    });
    return { all: vs, zh: zh };
  }
  function diagText() {
    var e = speakEnv(), info = LOCAL.info || {}, sv = sysVoices(), L = [];
    L.push('墨吟阅读器 诊断信息');
    L.push('版本：' + VER);
    L.push('包：' + diagPack());
    L.push('UA：' + navigator.userAgent);
    L.push('屏幕：' + screen.width + '×' + screen.height + ' @' +
      (window.devicePixelRatio || 1).toFixed(2) + '，窗口 ' + window.innerWidth + '×' + window.innerHeight);
    if (navigator.deviceMemory) L.push('内存：' + navigator.deviceMemory + ' GB');
    if (navigator.hardwareConcurrency) L.push('CPU：' + navigator.hardwareConcurrency + ' 核');
    L.push('语音桥：' + (info.ok === true ? '已连上'
      : (LOCAL.info ? '连上但未就绪' : '未连上')) + '（127.0.0.1:' + CFG.localPort + '）');
    L.push('本地引擎：ok=' + (info.ok === undefined ? '未知' : String(info.ok)) +
      (info.loading ? '｜loading' : '') +
      (info.detail ? '｜报告=' + String(info.detail).slice(0, 300) : '') +
      (info.engine ? '｜' + info.engine : ''));
    if (info.voices) L.push('引擎音色数：' + Object.keys(info.voices).length +
      (info.curated ? '（精选 ' + info.curated.length + '）' : ''));
    L.push('当前音色：' + (CFG.localVoice || '-') + '（' + localVoiceName(CFG.localVoice) + '）');
    L.push('系统朗读：' + (sv.all.length
      ? sv.all.length + ' 个引擎，其中中文 ' + sv.zh.length + ' 个'
        + (sv.zh.length ? '｜' + sv.zh.slice(0, 4).map(function (v) { return v.name + '(' + v.lang + ')'; }).join('、') : '')
      : '一个引擎都没有'));
    L.push('阅读设置：' + CFG.mode + '｜' + CFG.lay + '｜分角色 ' + (CFG.roleOn ? '开' : '关'));
    return L.join('\n');
  }
  function copyDiag() {
    var t = diagText();
    copyText(t).then(function (ok) {
      if (ok) { closeModal(); toast(T('诊断信息已复制，粘贴发给作者就行'), 3800); }
      else diagShow(t);
    }, function () { diagShow(t); });
  }
  function diagShow(t) {
    showModal(T('诊断信息'), '<p>' + T('复制不了就截图这一段发作者。') + '</p>' +
      '<pre class="kv" style="white-space:pre-wrap;word-break:break-all;max-height:260px;overflow:auto">' +
      esc(t) + '</pre>', [{ label: T('关闭') }]);
  }
  /* 当前包能力，摆在「关于」最上面。
     小米那位反馈者就是照着完整版的引导去设系统 TTS，白折腾半天——他装的可能是不含语音库的包。
     与其让人猜，不如把「你这个包有没有离线语音」直接写出来。 */
  function packCard() {
    var e = speakEnv(), info = LOCAL.info || {}, sv = sysVoices(), cap;
    if (info.ok === true) {
      cap = T('可用 · {n} 个音色（精选 {c} 个）', {
        n: Object.keys(info.voices || {}).length || (LOCAL.list || []).length,
        c: (info.curated || []).length || 21
      });
    } else if (LOCAL.checking) cap = T('正在检测…');
    else if (LOCAL.info) cap = T('未就绪') + (info.detail ? '（' + String(info.detail).slice(0, 80) + '）' : '');
    else if (e.android && e.apk) cap = T('未连上（引擎可能还在启动，稍后再看）');
    else if (e.android) cap = T('本包没有（手机浏览器只能用系统朗读）');
    else cap = T('未连上（Lite 版不含语音库，完整版请先启动 VoicePack）');
    var sys = sv.all.length
      ? T('{n} 个引擎，中文 {c} 个', { n: sv.all.length, c: sv.zh.length })
      : T('一个都没有');
    return '<p class="kv" style="margin-bottom:14px">' +
      '<b>' + esc(diagPack()) + '</b> · v' + esc(VER) + '<br>' +
      T('离线神经语音：') + esc(cap) + '<br>' +
      T('系统朗读：') + esc(sys) +
      '</p>';
  }
  function speakBlocked() {
    var e = speakEnv(), title, body, btns, eng = (LOCAL.info && LOCAL.info.engine) || '';
    var info = LOCAL.info || {};
    if (e.android && e.apk && info.ok === true) {
      /* 引擎已经连上却走到这里：几乎都是首段合成慢、或上一段播放被打断。
         这时候去讲「手机缺中文语音」纯属误导——手机一点都不缺。 */
      title = T('语音引擎已连上，再点一次朗读');
      body = '<p>' + T('刚才这一次没出声，通常是第一段要现建推理会话、稍慢了一点。再点一下朗读，第二次就顺了。') + '</p>' +
        '<p class="kv">' + T('当前音色：{v}', { v: localVoiceName(CFG.localVoice) || CFG.localVoice }) + '</p>';
      btns = [
        { label: T('再试一次'), cls: 'pri', fn: function () { closeModal(); SPK.connecting = false; SPK.slow = false; LOCAL.firstSynth = true; startSpeak(); } },
        { label: T('关闭') }
      ];
    } else if (e.android && e.apk && (info.loading || LOCAL.slow)) {
      // 安卓版自带神经语音，第一次启动要解压 18 MB 模型，别把它说成「手机缺中文语音」
      title = LOCAL.slow ? T('语音引擎还在准备') : T('语音引擎正在准备');
      body = '<p>' + T('安卓版第一次启动要把中文语音模型解压到应用目录，一般十几秒；机器慢的时候会到半分钟。之后就不用再等了。') + '</p>' +
        '<p>' + T('稍等一下再点朗读就行，先看字也不耽误。') + '</p>';
      btns = [
        { label: T('再试一次'), cls: 'pri', fn: function () { closeModal(); SPK.slow = false; startSpeak(); } },
        { label: T('关闭') }
      ];
    } else if (e.android && e.apk && info.detail) {
      title = T('语音引擎没能启动');
      body = '<p>' + T('这一次神经语音没加载起来，可以把下面这行发给作者；也可以先用手机系统自带的中文语音顶上。') + '</p>' +
        '<p class="kv">' + T('引擎报告：{m}', { m: String(info.detail).slice(0, 180) }) + '</p>' +
        '<p>' + T('打开「设置 → 无障碍 / 更多设置 → 文字转语音」，选「小爱语音引擎」或「讯飞语音引擎」，下载中文语音包后回到墨吟再点朗读。') + '</p>';
      btns = [
        { label: T('再试一次'), cls: 'pri', fn: function () { closeModal(); LOCAL.ready = false; localProbe(true); } },
        { label: T('复制诊断信息'), fn: function () { copyDiag(); } },
        { label: T('关闭') }
      ];
    } else if (e.android && e.apk) {
      title = T('手机朗读还需要中文语音');
      body = '<p>' + T('墨吟已经接入了手机系统的朗读引擎，但这台手机眼下没有可用的中文语音。') + '</p>';
      if (LOCAL.info && LOCAL.info.ok === false && eng)
        body += '<p class="kv">' + T('引擎报告：{m}', { m: eng }) + '</p>';
      else if (!LOCAL.info)
        body += '<p class="kv">' + T('没连上手机内的语音桥（127.0.0.1:{p}）。可先完全退出墨吟再打开；若装了安全软件，请允许它访问本机网络。', { p: CFG.localPort }) + '</p>';
      body += '<p>' + T('打开「设置 → 无障碍 / 更多设置 → 文字转语音」，选「小爱语音引擎」或「讯飞语音引擎」，下载中文语音包后回到墨吟再点朗读。') + '</p>' +
        '<p class="kv">' + T('列表里一个引擎都没有时，可在应用商店搜「讯飞语记」或「Google 文字转语音」装上再试。') + '</p>';
      btns = [
        { label: T('再试一次'), cls: 'pri', fn: function () { closeModal(); LOCAL.ready = false; localProbe(true); } },
        { label: T('复制诊断信息'), fn: function () { copyDiag(); } },
        { label: T('关闭') }
      ];
    } else if (e.android) {
      title = T('手机浏览器不支持朗读');
      body = '<p>' + (e.inApp
        ? T('你现在是在微信 / QQ 的内置浏览器里打开，它既不允许下载，也不提供系统朗读。')
        : T('手机浏览器没有系统朗读接口，网页版没法直接念书。')) + '</p>' +
        '<p>' + T('装安卓版就可以了：187 个离线神经声线随包带走，断网也能听，是手机浏览器给不了的效果。') + '</p>' +
        '<p class="kv" style="word-break:break-all">' + esc(APK_URL) + '</p>' +
        (e.inApp ? '<p>' + T('在微信里请点右上角「…」→「在浏览器打开」，再下载。') + '</p>' : '');
      btns = [
        { label: T('去下载安卓版'), cls: 'pri', fn: function () { closeModal(); try { location.href = APK_URL; } catch (x) {} } },
        { label: T('关闭') }
      ];
    } else {
      title = T('这个浏览器不能朗读');
      body = '<p>' + T('朗读要用浏览器自带的语音接口。桌面端请用 Microsoft Edge 或 Chrome 打开；精简版系统还需要在「设置 → 时间和语言 → 语音」里装一个中文语音。') + '</p>' +
        (e.ios ? '<p>' + T('iPhone 上请用 Safari 打开，并在「设置 → 辅助功能 → 朗读内容」里打开「朗读所选项」。') + '</p>' : '');
      btns = [{ label: T('关闭') }];
    }
    showModal(title, body, btns);
  }
  function tryVoice() {
    if (SPK.playing) { stopSpeak(false); toast(T('已暂停书本朗读，开始试听')); }
    if (localReady()) {
      toast(T('正在试听免费离线音色：') + localVoiceName(CFG.localVoice) + ' …', 3200);
      // 第一次合成要在手机上现建推理会话，放宽到 90 秒；配角库还要先解压
      // 51 MB，给它 150 秒，成功后回到正常档位
      var tryLib = /^s\d+$/.test(CFG.localVoice);
      withTimeout(localURL(TRY_TEXT), tryLib ? 150000 : (LOCAL.firstSynth ? 90000 : 45000)).then(function (u) {
        LOCAL.firstSynth = false;
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        try {
          var q = a.play(); if (q && q.catch) q.catch(function () {});
          a.onended = a.onerror = function () { revokeURL(u); };
        } catch (e) { revokeURL(u); }
      }).catch(function (e) { toast(T('试听失败：') + e.message, 5600); });
      return;
    }
    if (!SYN || !UTT) { speakBlocked(); return; }
    var v = curVoice();
    try { SYN.cancel(); } catch (e) {}
    var u = new UTT(TRY_TEXT);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'zh-CN';
    u.rate = Number(CFG.rate); u.pitch = Number(CFG.pitch); u.volume = Number(CFG.volume);
    SPK.trying = true;
    toast(T('正在试听：{v}（不影响书本进度）', { v: v ? voiceLabel(v).split(' · ')[0] : T('默认语音') }), 3200);
    u.onend = u.onerror = function () { SPK.trying = false; };
    try { SYN.speak(u); } catch (e) { SPK.trying = false; toast(T('试听失败：') + e.message); }
  }
  function startSpeak(fromPi, noWait) {
    /* 扫描件没有文字层：能看不能说。别说成「引擎故障」，直说这本念不了。 */
    if (BK && BK.picture) {
      toast(T('这本 PDF 是扫描件，整页都是图片，没有可朗读的文字——只能看，念不了'), 4800);
      return;
    }
    /* 安卓壳里 System WebView 会给出一个「哑」的 speechSynthesis：对象建得出来、
       也能调 speak()，就是不出声。所以只要在安卓壳里，就必须等本机 127.0.0.1 的桥，
       不能因为 SYN 存在就走系统语音那条路——否则用户点了朗读，界面在动，耳朵里没有声音。
       注意必须连 Android 一起判：桌面 exe 也是从 127.0.0.1 加载的，那上面 SYN 是真的能用。 */
    var env0 = speakEnv();
    var needBridge = env0.android && env0.apk && CFG.localOn;
    /* 桌面端同样不能「一看没连上就用系统音」：刚打开软件就点朗读时，语音引擎
       往往还在解压模型、建常驻实例，这一刻探不到，于是开头几句先被系统机械音
       念掉；十几秒后引擎就绪，又中途换回神经语音——同一段话两种嗓子，
       正是「前几句不可用、几句后自动恢复」的来源。
       所以先等它一会儿（最多 8 秒，够冷启动把池子建好），等不到才退回系统语音。
       noWait 保证只等这一回：等不到就走系统语音，不在 8 秒后再来 8 秒。 */
    if (!needBridge && CFG.localOn && !LOCAL.ready && BK && !SPK.connecting && !noWait) {
      SPK.connecting = true;
      var tW = Date.now();
      toast(T('正在连接本地语音引擎…'), 2600);
      (function waitLocal() {
        localProbe(false).then(function (ok) {
          if (ok || Date.now() - tW >= 8000) { SPK.connecting = false; startSpeak(fromPi, true); return; }
          setTimeout(waitLocal, 900);
        });
      })();
      return;
    }
    /* 安卓壳里根本没有 speechSynthesis（System WebView 不实现 Web Speech API），
       SYN 一直是 null。原来的判断是「!SYN 就拦」，于是桥明明已经就绪、
       只差合成那一步，也会被挡回去弹「引擎已连上，再点一次朗读」——
       再点一次还是同一句，永远进不了朗读。桥能用的时候，有没有 SYN 都无所谓。 */
    if (!(needBridge && LOCAL.ready)) {
      if (needBridge && !LOCAL.ready) {
        if (SPK.connecting) { toast(T('语音引擎正在准备，稍等一下…'), 2200); return; }
        SPK.connecting = true;
        /* 安卓端第一次启动要先解压 18 MB 模型、再建推理会话，十几秒到半分钟都算正常。
           以前只探一次（2.2 秒就超时）就断定「没有引擎」，于是立刻回退系统语音，
           弹出「这台手机没有中文语音」——而引擎往往下一秒就好了，那条提示纯属误导。
           现在改成一直等到就绪，最多 60 秒；真出错（有 detail）才立刻放弃。 */
        var t0 = Date.now();
        toast(T('语音引擎正在准备，稍等一下…'), 4000);
        (function step() {
          localProbe(false).then(function (ok) {
            if (ok) { SPK.connecting = false; LOCAL.slow = false; startSpeak(fromPi); return; }
            var inf = LOCAL.info || {};
            if (inf.detail) { SPK.connecting = false; LOCAL.slow = false; speakBlocked(); return; }
            if (Date.now() - t0 >= 60000) { SPK.connecting = false; LOCAL.slow = true; speakBlocked(); return; }
            setTimeout(step, 1500);
          });
        })();
        return;
      }
      // 走到这里只剩桌面端：没有系统语音才是真没法读
      if (!SYN || !UTT) { speakBlocked(); return; }
    }
    if (!BK) return;
    SPK.connecting = false;             // 走到这里说明桥已经就绪，别把上一次的等待状态留着
    autoStop(true);                     // 朗读和自动阅读会互相抢滚动，先停自动
    SPK.on = true; SPK.fb = 0; SPK.seenEnd = false;
    wakeKeep(true);                     // 听书时别让屏幕自己熄了，一熄音频就断
    clearPref(); stopLocalAudio(); voiceBadge(curVoice());
    $('speakBar').classList.add('on'); syncRoleBtn();
    if (!$('spVoice').options.length || $('spVoice').options[0].value === '') fillVoices();
    SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
    if (!SPK.paras.length) {
      // 封面页 / 纯图片页：自动往后找有文字的章节
      var tries = 0;
      while (!SPK.paras.length && BK.ch < chapterCount() - 1 && tries < 5) {
        renderChapter(BK.ch + 1, { fromSpeak: true });
        SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
        tries++;
      }
      if (!SPK.paras.length) { toast(T('这几章都没有可朗读的文字')); return; }
    }
    /* 开口之前先把人定好：这一章前后几章里说过话的人一次性配好声线，
       之后不管认成名字、代词还是没写主，都只会落到这些人身上，不会临时换嗓子。 */
    SPK.scene = { f: '', m: '', lastWho: '', lastV: '' };
    SPK.castAt = '';
    if (CFG.roleOn && localReady()) buildCast(BK.ch);
    setPara(fromPi === undefined ? currentPara() : fromPi);
    SPK.playing = true;
    SPK.fails = 0; SPK.skipped = 0; SPK.slowTold = 0; SPK.slowN = 0;     // 每次开念都重新计：上次跳过的段不该赖到这次
    SPK.degraded = 0;                   // 重新点朗读时再给本地语音一次机会
    try { SYN.cancel(); } catch (e) {}
    speakChunk(0); $('spPlay').textContent = '❚❚';
    warmLib();
    /* 这一章里有英文就顺手把英文模型建起来（后台，不挡第一句） */
    try {
      if (hasLatin(String(BK.chapterText ? BK.chapterText(BK.ch) : '').slice(0, 6000))) warmEn();
    } catch (e) { }
    if (!$('spVoice').options.length || $('spVoice').options[0].value === '') fillVoices();
    var cv = curVoice();
    if (SYN && !(SYN.getVoices() || []).length) toast(T('系统未检测到朗读语音；Windows 可在「设置→时间和语言→语音」添加中文语音'), 5200);
    else if (SYN && !localReady() && cv && !isNatural(cv)) toast(T('当前是机械语音；装一次免费语音包即可离线听接近真人的中文，详见「免费神经语音」'), 5600);
  }
  function toggleSpeak() {
    if (!SPK.on) { startSpeak(); return; }
    if (SPK.playing) {
      SPK.playing = false; clearTimeout(SPK.gapT);
      if (SPK.audio) { try { SPK.audio.pause(); } catch (e) {} }
      else { SPK.gen++; clearTimeout(SPK.watch); try { SYN.pause(); } catch (e) {} }
      $('spPlay').textContent = '▶'; $('spNow').textContent = T('已暂停');
    } else {
      SPK.playing = true; clearTimeout(SPK.gapT);
      $('spPlay').textContent = '❚❚';
      if (SPK.audio) { try { SPK.audio.play(); } catch (e) {} return; }
      SPK.gen++;
      try { SYN.cancel(); } catch (e) {}
      if (SPK.chunks.length) speakChunk(0); else startSpeak(currentPara());
    }
  }
  function stopSpeak(hide) {
    wakeKeep(false);
    SPK.playing = false; SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio(); clearPref();
    clearInterval(SPK.timer); SPK.deadline = 0; $('spLeft').textContent = '';
    try { if (SYN) SYN.cancel(); } catch (e) {}
    $('page').querySelectorAll('.rdp.speaking').forEach(function (e) { e.classList.remove('speaking'); });
    $('spPlay').textContent = '▶'; $('spNow').textContent = '';
    if (hide) { SPK.on = false; $('speakBar').classList.remove('on'); }
  }
  function speakJump(d) {
    if (!SPK.paras.length) return;
    var wasPlaying = SPK.playing;
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio(); clearPref();
    try { SYN.cancel(); } catch (e) {}
    SPK.playing = false;
    setPara(Math.max(0, Math.min(SPK.paras.length - 1, SPK.pi + d)));
    highlight();
    if (wasPlaying) { SPK.playing = true; speakChunk(0); }
  }
  function speakTimer(min) {
    clearInterval(SPK.timer); SPK.deadline = min ? Date.now() + min * 60000 : 0;
    if (!min) { $('spLeft').textContent = ''; return; }
    SPK.timer = setInterval(function () {
      var left = SPK.deadline - Date.now();
      if (left <= 0) { clearInterval(SPK.timer); SPK.deadline = 0; $('spLeft').textContent = ''; stopSpeak(false); toast(T('朗读定时到，已停止')); return; }
      $('spLeft').textContent = T('剩 {n} 分', { n: Math.ceil(left / 60000) });
    }, 1000);
    $('spLeft').textContent = T('剩 {n} 分', { n: min });
  }

  /* ---------------- 弹层 / 文档 ---------------- */
  /* 点插图看大图：EPUB 里那些小图（地图、人物关系表、插图页）在正文里永远看不清 */
  function showImg(u) {
    var v = $('imgView'); if (!v || !u) return;
    v.querySelector('img').src = u;
    v.classList.add('on');
  }
  function hideImg() {
    var v = $('imgView'); if (!v) return;
    v.classList.remove('on');
    setTimeout(function () { if (!v.classList.contains('on')) v.querySelector('img').src = ''; }, 200);
  }
  function showModal(title, body, buttons) {
    $('modalTitle').textContent = title;
    var mb = $('modalBody');
    mb.oninput = mb.onchange = mb.onclick = null;   // 防止多次打开时监听器叠加
    mb.innerHTML = body;
    var f = $('modalFoot'); f.innerHTML = '';
    (buttons || [{ label: T('关闭') }]).forEach(function (b) {
      var el = document.createElement('button');
      el.textContent = b.label; if (b.cls) el.className = b.cls;
      el.onclick = function () { if (b.fn) b.fn(); else closeModal(); };
      f.appendChild(el);
    });
    $('modal').classList.add('on');
  }
  function closeModal() { $('modal').classList.remove('on'); }
  function confirmModal(msg, yes) {
    showModal(T('请确认'), '<p>' + esc(msg) + '</p>', [
      { label: T('取消') },
      { label: T('确定'), cls: 'pri', fn: function () { closeModal(); yes(); } }
    ]);
  }
  var DOCS = {
    help: ['使用说明', '<h3>导入</h3><p>书架点「＋ 导入书籍」，可选多本 <code>.txt</code> / <code>.epub</code>。文件只保存在这台设备的浏览器数据库里，导入过程不上传、不联网。</p>' +
      '<h3>阅读</h3><ul><li>顶部「目录」跳章，「搜索」全文找词，「＋书签」记位置。</li><li>底部进度条可拖到全书任意章节；滚动模式下 ← → 键翻章，空格向下翻一屏。</li><li>点正文：<b>左边三分之一</b>翻上一页、<b>右边三分之一</b>翻下一页（翻页模式下），<b>中间</b>收 / 放上下工具栏；收起后点屏幕最上面那条窄边也能唤回。</li><li>快捷方式：← / → 翻章（翻页模式下是翻页），空格 下翻一屏（朗读中则暂停 / 继续），Ctrl + F 搜索，Esc 退回书架或关掉弹窗。</li><li>「排版」一处调完：阅读方式（滚动 / 翻页）、分栏、翻页动画、字号、行距、段间距、字间距、首行缩进、字体、对齐、版心宽度、页边距、六套主题与自定义底色字色、亮度、自动阅读速度。</li><li>「主题」按顺序切六套配色；「自动」开关自动阅读；「全屏」进入沉浸模式。</li><li>阅读位置自动保存，下次打开接着读；翻页模式还会记住翻到第几页。</li></ul>' +
      '<h3>划线、批注与分享</h3>' +
      '<p>在正文里选中任意一句，会浮出一个小工具条：四色高亮、写笔记、复制、生成分享图。高亮和批注随书保存，右侧「笔记」页会按章节列出全部批注，点一条就能跳回去；在那里还能按「仅看有笔记的」筛选、改色、编辑或删除，并一键<b>导出成 Markdown</b> 或打开<b>阅读总结</b>（累计时长、进度、批注数、逐章摘录，可复制或导出）。</p>' +
      '<h3>书架与收藏</h3>' +
      '<p>书架上方一排标签是书架本身：「全部书籍」「★ 收藏」和你自建的书架。点「管理书架」可新建、重命名或解散书架（解散不会删书，书回到「未分组」）。每本书封面右上角的 ☆ 是收藏、⋯ 是菜单（改书名作者、移动书架、批量管理、移除）。批量管理可一次移动或移除多本。</p>' +
      '<p>「导入文件夹」会把整个目录里的 TXT / EPUB 一次收进来，重复文件自动跳过。更快的办法是把文件或文件夹<b>直接拖进窗口</b>，松手就导入。</p>' +
      '<p><b>网络位置</b>（桌面版）：书架上的「网络位置」可以填局域网共享路径，比如 <code>\\\\192.168.1.10\\Books</code>、映射到网络的盘符 <code>Z:\\书</code>，或本机任意绝对路径。走的是系统自己的网络访问，账号密码由 Windows 记着——只要在资源管理器里能打开，这里就能直接扫、直接读，不用先把书拷过来。手机上不显示这个按钮。</p>' +
      '<h3>朗读</h3><p>点「朗读」从当前屏幕位置开始念。底部条可选语音、语速、上一段 / 下一段、定时停止；正在念的段落会高亮并自动跟随滚动，念完一章自动接下一章。</p>' +
      '<p><b>续听</b>：听到哪会单独记住（与「读到哪」分开记，互不干扰）。回到书架，书本卡片下方会出现「▶ 续听 · 第 N 章」，点一下就从上次听的那一段接着念；想按看书的位置念，点开书再点「朗读」即可。朗读条最左边的下拉可随时换声线，正在念时会用新声线把当前这段重念一遍。</p>' +
      '<p>不装任何东西也能直接朗读（用系统自带语音）。想要接近真人的中文，可看「阅读设置 → 免费神经语音」：随成品附带的开源语音库已经装好（桌面约 90 MB：22 kHz 女主 18 MB ＋ 22 kHz 男主 18 MB ＋ 187 人配角库 38 MB），之后<b>永久离线、免费、无需账号</b>。不用它时，语音下拉按「自然语音 / 在线 / 本地」分组，默认优先选最好的那个。</p>' +
      '<h3>备份</h3><p>书架底部「导出备份」保存进度、书签、设置；勾选「含书籍文件」可把原书一起带走。换设备时用「导入备份」还原。</p>'],
    voice: ['语音与朗读', '<h3>为什么会觉得「机械」</h3>' +
      '<p class="kv">只想尽快听到自然的中文？看「阅读设置 → 免费神经语音」：一次下载开源语音库，之后完全离线、不花一分钱。</p>' +
      '<p>浏览器朗读用的是系统语音引擎。Windows 自带的「慧慧 / 康康 / 瑶瑶」是老式拼接合成，语调平、断句硬，听起来像机器人；名称里带 <code>Online (Natural)</code> 的是神经网络语音，会自己处理语调、重音与句末降调，接近真人朗读。</p>' +
      '<h3>三条路怎么选</h3><ul>' +
      '<li><b>⭐ 免费离线神经语音（推荐）</b>：本机跑开源的 sherpa-onnx + 中文神经语音模型，语调接近真人，<b>不联网、不收费、不需要账号、不需要 Key</b>。语音库已随成品装好：一份 16 kHz 的 187 人库（148 女 + 39 男），精选 {cur} 个直接可选、<b>任何一条都能设成主角</b>，还能按人物分角色朗读；听书前双击一下启动器。详见「免费神经语音」。</li>' +
      '<li><b>⭐ 自然语音</b>：名称含 <code>Natural</code> / <code>Neural</code>，由 Microsoft Edge 提供，音质好但<b>需要联网</b>，国内网络常常连不上微软语音服务。</li>' +
      '<li><b>本地语音</b>：完全离线、响应快，但机械感明显。断网或临时凑合时用它。</li></ul>' +
      '<p>语音下拉已按这几类分组，旁边的标签会显示当前是「● 免费神经语音」还是「● 本地语音（较机械）」；点「试听」可直接对比不同声音，不影响阅读进度。</p>' +
      '<h3>列表里没有自然语音？</h3><ol>' +
      '<li><b>用 Microsoft Edge 打开本文件</b>（右键 → 打开方式 → Microsoft Edge）。Chrome 的中文在线语音依赖 Google 服务，国内多数网络下取不到。</li>' +
      '<li>Edge「设置 → 语言」确认已添加「中文（简体）」；Windows「设置 → 时间和语言 → 语言和区域 → 中文(简体) → 语言选项 → 语音 → 下载」安装语音包，然后重启 Edge。</li>' +
      '<li>也可以不走这条路，直接装免费离线语音包，不依赖任何在线服务。</li></ol>' +
      '<h3>让朗读更自然的三个旋钮</h3><ul>' +
      '<li><b>整句朗读</b>（默认开）：按完整句子切分，不从句中间硬切，神经语音才有连贯语调。</li>' +
      '<li><b>句间停顿</b>（默认 120 毫秒）：句子之间留一点静默，段落间自动加倍；在「阅读设置 → 朗读」可调 0~600 毫秒。</li>' +
      '<li><b>语速 0.9~1.1×</b>：中文听书最舒服的区间，过快会吃掉语气，过慢显得拖沓。</li></ul>' +
      '<h3>隐私说明</h3><p>用免费离线语音包或系统本地语音时，朗读完全在本机完成，<b>不产生任何对外网络请求</b>，书里的一个字都不会离开这台电脑。只有主动选 <code>Online (Natural)</code> 语音时，浏览器才会把正在念的那段文字发给微软合成——这是浏览器语音引擎的行为，本工具不额外上传书籍、进度或设置。</p>' +
      '<p>在线语音连不上时会自动回退到本地语音并提示，不会卡住不动。朗读引擎与音色因设备、系统语言包而异，本工具不保证与真人朗读一致。</p>' +
      '<h3>试听没声音 / 自动切回本地语音？</h3>' +
      '<p>在线神经语音需要连接 <code>speech.platform.bing.com</code>。该域名在国内部分网络下会被阻断或限流（中国区还额外要求短期令牌），表现为点「试听」没声。这不是书籍或本工具的问题，装免费离线语音包即可彻底绕开。</p><ul>' +
      '<li>让 <code>speech.platform.bing.com</code> 走可用的代理 / 加速器（全局模式），然后点「试听」验证；成功后在语音下拉里重新选回「⭐ 自然语音」。</li>' +
      '<li>换网络（例如手机热点）或换个时段再试。</li>' +
      '<li>不想折腾网络：直接看「免费神经语音」，一次下载后永久离线可用。</li></ul>'],
    local: ['免费离线神经语音', '<h3>这是什么</h3>' +
      '<p>一个<b>完全免费、完全离线</b>的中文神经网络语音方案：开源引擎 <code>sherpa-onnx</code>（Apache-2.0）＋ ' + (isLite() ? '一份 16 kHz 187 人的多说话人模型 <code>fanchen-C</code>（这一版没带 22 kHz 的主角模型）' : '三份开源中文 VITS 模型：22 kHz 女主「小雅」、22 kHz 男主「超文」、16 kHz 187 人配角库 <code>fanchen-C</code>') + '。语调、停顿、重音接近真人，和 Windows 自带的慧慧 / 康康不是一个量级。</p>' +
      '<p>语音合成在<b>你自己的电脑</b>上完成：不需要注册账号、不需要 API Key、不联网、不按字数收费，书里的文字一个字节都不会发出去。</p>' +
      '<h3>两步开始听（本机已经装好）</h3><ol>' +
      '<li>打开随成品附带的 <code>VoicePack</code> 文件夹，双击 <code>启动语音引擎.cmd</code>。它会开一个小窗口跑本机服务，并自动用 Edge 打开阅读器。<b>不用下载、不用安装、不用填任何东西。</b>（同目录的 <code>START.cmd</code> 是同一个脚本的英文名，随便点哪个都行。）</li>' +
      '<li>阅读器右下角标签变成绿色「● 免费神经语音」即已连上；点「试听音色」确认出声。关掉那个小窗口即停止服务，之后会自动退回系统语音，不影响看书。</li></ol>' +
      '<p class="kv">换一台电脑时：把整个 <code>VoicePack</code> 文件夹拷过去（含已装好的引擎与模型，约 53 MB）即可直接用；若只想拷脚本，在新电脑双击 <code>安装语音包.cmd</code> 重新下载（约 53 MB，走国内加速源，自动分段并发）。Windows 版语音库，拷到别的系统不能直接用。<br><b>Windows 桌面完整版 EXE 已把语音库打包进 exe 内</b>：只拷一个 exe 过去就能听（整个软件约 47 MB），首次启动自动释放到本机缓存，不需要 VoicePack 文件夹。</p>' +
      (isLite() ? '<h3>内置音色 · 187 个普通人的声音（148 女 + 39 男）</h3>' +
        '<p><b>1.14.40 起成品只带这一份 16 kHz 的 <code>fanchen-C</code> 187 人库</b>：那两份 22 kHz 的小雅 / 超文主角模型不再随包，安装包因此小了 25 MB。187 条声线全部常驻、任意一条都能设成主角，旁白默认落在「成年女 1」，不合胃口换一条就好。' :
        '<h3>内置音色 · 2 个高采样率主角（女 / 男）＋ 187 个配角说话人（148 女 + 39 男）</h3>' +
        '<p>主角是两份 22.05 kHz 的单说话人模型：「墨吟 · 女声」（小雅）与「墨吟 · 男声」（超文），齿音、气口、句尾收束都在，专门给男女主角用。配角另有 187 个中文说话人（16 kHz），男女各档都有。') + '下拉默认只列人工挑选命名过的 <b>精选 {cur} 个</b>（手机版 30 个）；想听更多，到「阅读设置 → 免费神经语音 → 声线范围」点「全部 {total} 个」，下拉会按音高分 7 档列出（男声低沉 / 中年 / 偏高，女声低音 / 成年 / 青年 / 高音）。点「试听音色」逐个对比，也可以直接在朗读条最左边的下拉里换（正在朗读时会用新音色重念当前这段），语速用朗读条滑块控制。全部是离线神经语音，普通电脑 CPU 就能实时合成。</p>' +
      '<p><b>为什么 187 个声音却不占体积</b>：它们全部来自同一份 fanchen-C 中文多说话人模型（打包时把权重压成 8 位整数，从 115 MB 降到 38 MB），切换只是换一个 <code>--sid</code> 编号，所以放开到 187 个也是<b>零体积成本</b>。压缩的代价是合成慢一些（同一句话约慢 10 倍）。' + (isLite() ? '不随包附带那两份 22 kHz 主角模型，换来的就是安装包小 25 MB。' : '所以它只当配角用，男女主角和旁白走那两份 22 kHz 模型。') + '官方只给编号没有花名，「男声低沉 / 女声清亮」是按每个说话人实测的中位基频（F0）分档的，描述词只便于分辨，<b>建议点「试听音色」挑自己最喜欢的那一个</b>。</p>' +
      '<p class="kv">长篇小说先试默认的「声线 12」（温润偏低），想换亮一点的试「声线 160」或「声线 150」，要男声试「声线 110」。合成很快（一句 4~7 秒音频约 1 秒生成）。下拉只列出本机已装好的音色，缺模型文件会自动隐藏。</p>' +
      '<h3>分角色朗读（多人对话自动换声）</h3>' +
      '<p>点朗读条上的「多角色」按钮，或到「阅读设置 → 分角色朗读」开启：<b>旁白还是用你选的声线，引号里的对白按人物自动换成不同的声音</b>。开始朗读前会先把这一章前后几章里说过话的人扫一遍、一次性把声线定好，同一个人物整本书都是同一个声音（代词「他 / 她」也会绑回那个人，不另起一条声线）；认不出是谁的那句沿用上一位的声音，只有真的换了人才变。</p>' +
      '<p>角色音色池可选「男女混合 / 全女声 / 全男声」。设置里的「试听效果」会念一小段带对白的示例，直接听差别。正在念的时候开或关都立刻生效，并从当前这一段重新开始念。</p>' +
      '<p class="kv">只在「免费神经语音」下生效——系统语音一次只能出一个声音，做不到分角色。旁白声线就是你在音色里选的那个；想换最常出现的那个角色声音，直接换旁白声线（角色池会自动避开它）。</p>' +
      '<h3>工作原理</h3>' +
      '<p>启动器在本机 <code>127.0.0.1</code> 开一个只监听本机的 HTTP 服务（Python 标准库，零第三方依赖）。阅读器把<b>正在念的那一句</b>发给它，它调用引擎生成 WAV 再回传播放，并自动预取下一句，听起来基本无等待。服务不监听外网、不写日志、不收集任何数据。</p>' +
      '<p><code>VoicePack</code> 文件夹是独立的：<code>tts_server.py</code> 只用 Python 标准库，<code>安装语音包.cmd</code> 只在你主动运行时从官方发布页下载开源文件。它不写注册表、不装系统组件、不开机自启；整个删掉也不影响阅读器本身。</p>' +
      '<h3>连不上 / 没声音</h3><ul>' +
      '<li>标签一直是「● 本地语音」：说明引擎没启动。双击 <code>启动语音引擎.cmd</code>，再到「阅读设置 → 免费神经语音」点「重新检测」。</li>' +
      '<li>提示端口被占用：在设置里改「端口」，启动器与阅读器保持一致即可。</li>' +
      '<li>提示模型缺失：重跑一次 <code>安装语音包.cmd</code>，等它显示下载完成。</li>' +
      '<li>第一次点朗读有 1~2 秒延迟是引擎在加载模型，之后会快很多；老机器可把「句间停顿」调小一点。</li>' +
      '<li>任何失败都会自动切回系统语音，不会卡住，也不会丢阅读进度。</li></ul>' +
      '<h3>许可</h3><p>引擎 <code>sherpa-onnx</code>（Apache-2.0）与 <code>fanchen-C</code>、<code>xiao_ya</code>、<code>chaowen</code> 三个中文 VITS 模型均为开源项目，按各自许可证使用；这些开源文件随成品一起放在 VoicePack 文件夹里，只为方便本机调用，可随时整个删除；本阅读器不修改它们、不写系统组件、不联网分发。</p>'],
    faq: ['常见问题', '<h3>朗读声音像机器人？</h3><p>直接用随成品装好的免费离线语音包：双击 <code>VoicePack/启动语音引擎.cmd</code> 即可，不用下载任何东西。完全离线、免费、无需账号，详见「免费神经语音」。不想下载也可以用 Microsoft Edge 打开本文件，在语音下拉选「⭐ 自然语音」分组里的晓晓或云扬。</p>' +
      '<h3>要钱吗？要注册吗？</h3><p>都不要。阅读器本身、离线语音引擎与中文模型全部免费开源，没有账号、没有 Key、没有按量计费，也不上传任何文字。只有 Windows / Edge 自带的在线语音是微软的服务，与收费无关但国内常常连不上。</p>' +
      '<h3>TXT 打开是乱码？</h3><p>默认自动识别 UTF-8 / GB18030 / UTF-16。若仍乱码，到「阅读设置 → TXT 编码」手动指定（GB18030 / Big5 / UTF-16LE），再重新打开这本书。</p>' +
      '<h3>朗读没声音 / 中文念得像英文？</h3><p>Windows：设置 → 时间和语言 → 语音 → 添加中文（简体）语音包；然后重启浏览器。朗读条里的语音下拉要选 <code>zh-CN</code> 开头的项。部分安卓 WebView 没有语音引擎，需装系统 TTS。</p>' +
      '<h3>EPUB 打开失败？</h3><p>支持标准 EPUB2 / EPUB3（ZIP + OPF + spine）。带 DRM 加密、或 Amazon 专用 AZW3 / MOBI 不在支持范围。极端老书的内部路径不规范时，解析器会做大小写与编码容错。</p>' +
      '<h3>清了浏览器缓存，书没了？</h3><p>数据存在浏览器 IndexedDB，清理站点数据会一并删除。重要书籍请先「导出备份」，同时保留原始文件。</p>' +
      '<h3>换电脑 / 手机怎么带过去？</h3><p>导出备份 JSON（勾「含书籍文件」），把 JSON 和这个 HTML 一起拷过去，在新设备点「导入备份」即可。也可只拷 HTML + 原书重新导入。离线语音库是 Windows 版，把 VoicePack 文件夹一起拷过去即可用。</p>' +
      '<h3>书架上的「续听」是什么？</h3><p>听到哪会被单独记住，和「读到哪」互不干扰。听完回到书架，书本卡片下方就有「▶ 续听 · 第 N 章」，点一下从上次听的那一段接着念。想按看书的位置念，点开书再点「朗读」即可。没听过这本书时不会出现这个按钮。</p>' +
      '<h3>念到一半想换个声音？</h3><p>朗读条最左边的下拉里固定放着主角那套（原版男女声 + 8 个音高变体，删不掉），下面是<b>你自己置顶的声线</b>——置顶就是当主角用，点哪个名字朗读就换成哪个。想去掉某个，到「阅读设置 → 我的主角声线」点它右边的 × 就删了——那只影响朗读条这个下拉，设置里 {total} 个声线一个都不会少，随时能再加回来。想把对话也换成不同声音，点旁边的「多角色」。换完会用新声线把当前这一段重念一遍，不用停也不用回书架。想先试听再决定，去「阅读设置 → 免费神经语音 → 试听音色」。</p>' +
      '<h3>手机上按钮挤？</h3><p>按钮会按屏幕宽度自动换成多行网格，不用手动切。手机上的正文一律单栏，横屏也不会硬分两栏。</p>' +
      '<h3>怎么弄成两栏？</h3><p>点阅读器顶栏「⋯」里的「排版」→「阅读方式」：切到「翻页」，分栏选「自动分栏」在宽屏上就是左右两栏，选「双栏」可以强制（窗口够宽时）；窗口太窄或手机上会自动退回单栏，不会把字挤成一条。<br>顺带一提，翻页模式翻的是整屏而不是滚动：点屏幕<b>左边三分之一</b>回上一页、<b>右边三分之一</b>翻下一页，滚轮、空格或 ← → 也都行，手机上还能左右滑。点屏幕<b>中间</b>是收 / 放上下工具栏——收起来之后正文占满整屏，再点中间或点最上面那条窄边就能唤回。</p>' +
      '<h3>自动阅读怎么用？</h3><p>点顶栏「⋯」里的「自动」，滚动模式下会匀速往下滚，翻页模式下按你设的秒数自动翻页；再点一次暂停，暂停时会留一个胶囊提示，可以继续或退出。到本章末尾会自动接下一章。朗读和自动阅读不会同时抢滚动。</p>' +
      '<h3>想看得更沉浸？</h3><p>点屏幕<b>中间</b>就能把上下工具栏收起来（最省事）；想连窗口边框一起收，点「⋯」里的「全屏」或按 F11。收起后点屏幕中间或最上面那条窄边就能唤回，鼠标移到屏幕上边或下边也行。想更暗一点，在「排版 → 配色 → 亮度」往下拉，正文会压暗一层夜里不刺眼。</p>' +
      '<p class="kv">还有问题？读一下「关于」里的实现说明，或到发行包 README 里找反馈入口。</p>'],
    open: ['开源与许可', '<h3>许可证</h3>' +
      '<p><b>墨吟 · MoYin Reader</b> 以 <b>MIT 许可证</b>发布，版权归 <b>© 2026 永远的兰兰（Lanlan Eternal）</b>所有。</p>' +
      '<p>你被允许：自由使用、复制、修改、合并、发布、再授权、甚至商业使用；唯一义务是保留上述版权声明与本许可声明。软件按「现状」提供，不含任何担保。</p>' +
      '<p class="kv">完整英文条款随发行包以 <code>LICENSE</code> 文件提供（MIT，标准全文）。仓库根目录同放一份，转载或二次分发时请一并保留。</p>' +
      '<h3>第三方组件</h3><ul>' +
      '<li><code>sherpa-onnx</code> 语音引擎 —— Apache-2.0，作者 k2-fsa 社区，本项目仅在本机以子进程方式调用。</li>' +
      '<li><code>fanchen-C</code> 中文 187 人 VITS 模型 —— 按其在 HuggingFace 发布页的条款使用；主角用的 <code>xiao_ya</code>、<code>chaowen</code> 为 Piper 中文模型，同按其发布页条款使用。</li>' +
      '<li><code>pywebview</code> + <code>pythonnet</code> —— BSD-3-Clause / MIT，仅 Windows 桌面壳使用，用于把内置页面装进系统窗口。</li>' +
      '<li><code>PyInstaller</code> —— GPL-2.0 附 bootloader 例外条款，只用于把脚本打成单文件 exe，不影响本项目的 MIT 授权。</li>' +
      '<li>Microsoft Edge WebView2 运行时 —— 微软随系统分发的运行环境，本项目不打包、不修改，仅调用系统已安装的版本。</li></ul>' +
      '<p>上述组件的著作权归各自作者，本项目不改动其源码，也不为其功能、安全或后续维护作担保。语音模型文件单独放在 <code>VoicePack</code> 目录（完整版 exe 内嵌在尾部），可按需删除而不影响阅读功能。</p>' +
      '<h3>本项目自有的部分</h3>' +
      '<p>页面、样式、<code>zipcore.js</code>（自行实现的 ZIP / DEFLATE / 字符编码解码内核）、EPUB 解析、朗读调度、单文件打包与自检脚本均为原创实现，同样以 MIT 授权。其中 DEFLATE 解码按 RFC 1951 规范独立编写，未抄录 zlib 源码。</p>' +
      '<h3>再分发时请注意</h3>' +
      '<p>本软件不附带任何书籍内容。把软件连同语音模型一起转发时，请一并保留 <code>LICENSE</code> 与本文档；不要移除界面里的作者署名，也不要暗示原作者为你的修改版背书。</p>'],
    disclaimer: ['免责声明', '<p>本工具仅供个人阅读自己合法持有的电子书使用，不提供、不获取、不破解任何受版权保护的内容，不绕过任何数字版权管理（DRM）。使用者需自行确保对所导入文件拥有合法使用权，因使用本工具产生的版权纠纷由使用者自行承担。</p>' +
      '<p>导入的书籍、书签与阅读进度全部保存在本机浏览器数据库中，不会上传到任何服务器；作者与本页面均无法访问你的文件内容。<b>唯一例外</b>：当用户主动选择名称含 <code>Online (Natural)</code> 的在线语音时，浏览器会把当前朗读的文字发送给其语音服务进行合成，该行为由浏览器语音引擎发起，与本工具的书籍存储无关。请自行做好原始文件与备份的保管，因浏览器清理、设备故障、文件损坏造成的数据丢失，本工具不承担责任。</p>' +
      '<p>「免费神经语音」用到的 sherpa-onnx 引擎与三个中文语音模型是第三方开源软件，由用户自行下载、自行决定是否运行，各自遵守其原始许可证；本工具只是本机调用，不分发、不修改、不为其可用性或安全性作担保。相关脚本只在本机 127.0.0.1 监听，不对外提供服务，请在可信网络环境下使用。</p>' +
      '<p>朗读依赖操作系统 / 浏览器提供的语音引擎，音色、可用性、断句效果因设备而异，不保证与人工朗读一致。驾车、操作机械等需要注意力的场合请勿收听。</p>' +
      '<p>本软件按「现状」提供，不附带任何明示或默示担保。在法律允许的最大范围内，作者不对使用或无法使用本软件造成的任何直接或间接损失（含数据丢失、设备损坏、时间或收入损失）承担责任。</p>' +
      '<p>「墨吟」的名称、界面与文档著作权归作者所有；文中提及的其他产品、公司、语音服务名称可能是其各自所有者的商标，仅用于说明用途，不表示任何关联、赞助或背书。</p>' +
      '<p><b>关于联网与权限</b>：除了上面说的检查更新（一个普通 GET 取版本号，不带书名也不带设备标识）和下载安装包 / 语音模型之外，软件不发起任何网络请求——没有统计、没有埋点、没有广告 SDK、没有崩溃上报。下载默认直连 GitHub 官方地址，中间没有别的服务器；只有在下载页上<b>由你本人点了</b>镜像链接时，请求才会经过 <code>gh-proxy.com</code> 这类第三方反代，对方能看到你的 IP 与浏览器标识。安卓包只申请 <code>INTERNET</code> 与 <code>ACCESS_NETWORK_STATE</code> 两个权限，不读存储、位置、通讯录、相机、麦克风，也不读 IMEI / Android ID / MAC。完整隐私说明随发行包以 <code>PRIVACY.md</code> 提供。</p>' +
      '<p><b>关于声音</b>：187 个配角声线来自公开多说话人数据集训练的开源模型，主角两份来自公开 Piper 中文模型。它们只是合成音色，不用于声纹识别，也不代表任何真实人物；软件不提供声音克隆，不采集、不上传你本人的录音。界面里的声线名字是产品内的档位名，不是对任何人的称呼或代言。</p>' +
      '<p>若你是权利人，认为本工具或其随附内容侵犯了你的权益，请通过发行包内 README 所示方式联系作者，核实后会及时处理。</p>'],
    about: ['关于', '<p style="font-size:1.2em"><b>墨吟 · MoYin Reader</b></p>' +
      '<p>一个单文件、默认离线的 TXT / EPUB / PDF 阅读器，带朗读。双击 HTML 就能用，Windows / Linux / 安卓 / iOS 浏览器均可。</p>' +
      '<p>「墨吟」取「以墨为文、吟而出声」：把纸上的字念出来。中文名与英文名均为本项目自用，与任何同名公司、配音平台、有声主播<b>没有关联</b>，也不代表任何商业背书。</p>' +
      '<p>书架 + 阅读器的布局与朗读机制参考了本机 Koodo Reader 的交互思路，代码为零依赖重写：EPUB 的 ZIP 解压、OPF / NCX / Nav 目录、正文与插图解析全部内置，不加载任何外部脚本或 CDN。</p>' +
      '<p>它的声音理念很简单：<b>用普通人的声音，讲普通人的故事</b>。这里没有修得毫无瑕疵的录音棚嗓音——那种声音属于播音腔，听久了反倒离故事远。187 个人声，男女老少、清亮低沉都有，<b>总有一个让你心动的声音</b>；合耳的留下，不合耳的删掉，选择权在你手上。</p>' +
      '<p class="kv">朗读可接免费的开源离线神经语音（sherpa-onnx + 三份中文 VITS 模型）：不联网、不收费、无需账号，带 187 个中文说话人（148 女 + 39 男），精选 {cur} 个常用声线、任何一条都能设成主角，还支持按人物分角色朗读；语音库随成品放在 VoicePack 文件夹里，Windows 桌面完整版 EXE 已把它打包进 exe 内，只拷一个 exe 就能听。</p>' +
      '<p>本软件以 <b>MIT 许可证</b>开源：可自由使用、修改、再分发（含商用），保留版权与许可声明即可。完整条款见「开源与许可」。</p>' +
      '<h3>1.14.40 改了什么</h3><ul>' +
      '<li><b>把两份 22 kHz 主角模型从安装包里拿掉了</b>：小雅（女）与超文（男）各 18.65 MB，压缩后合起来 25.2 MB。它们的优势只剩「采样率高一点」——187 人那套 1.14.39 常驻之后一句 0.92 秒，跟主角同速。桌面 exe 150 → <b>125 MB</b>，安卓包 128 → <b>102 MB</b>，内存基线从 390 MB 降到 250 MB。</li>' +
      '<li><b>默认旁白换成真人声线</b>：以前默认是「墨吟 · 女声」，现在落在精选里的「成年女 1」（s13）；男声默认「中年男 1」（s58）。选过别的声线的不受影响。</li>' +
      '<li><b>老配置不会哑</b>：升级后如果配置里还存着 x0 / c0 / f1~m3，会自动落到上面这两条，不用重新挑。老 VoicePack 目录里还带着那两份模型的话，它们仍会出现在声线表里，照样能选。</li>' +
      '<li><b>精选补两条</b>：拿走两条主角后补位成 50 条——「中年男 7」（162 Hz，填 140~165 的中段）与「青年女 15」（263 Hz，接原本 x0 的位置）。原来 48 条 sid 一个没动。</li>' +
      '</ul>' +
      '<h3>1.14.39 改了什么</h3><ul>' +
      '<li><b>关于页的版本号终于对了</b>：中间几个测试版的号只改了包名，关于页还写着 1.14.35。现在合成一个号，以后不会再对不上。</li>' +
      '<li><b>187 个声线全部改成常驻</b>：以前只有两份 22 kHz 主角是常驻的，配角库每念一句都要重起一次进程——实测一句要 12 秒，所以桌面端只敢把 8 个音高变体放进精选。这次把 187 人那套也常驻起来（同一份模型、靠 sid 换人），<b>一句 19 字实测 0.92 秒</b>，跟主角一个速度。省下来的时间直接换成可选的声音。</li>' +
      '<li><b>桌面端精选 50 条，手机端 30 条</b>：手机屏幕小、一次翻不完，30 条够用；桌面这次补到 50。新加的 18 条不是随便挑的，补的都是各档原来空着的音高位置——男低沉补到 4 条、男偏高补 2 条填住低端、女低音/成年/青年各补几条，女高音第一次有了成年女声（以前只有童声）。<b>原来 30 条一条没动，sid 一个没改</b>，你选中的声音还是同一个。</li>' +
      '<li><b>「置顶」就是「设为主角」，现在写在明处</b>：设置页那一栏改叫「我的主角声线」，朗读条下拉的两组也标成「置顶＝主角」——点哪个名字，朗读立刻换成哪个，不用再点第二次确认。点 × 只是把它从下拉里拿掉，不会取消正在念的声音。</li>' +
      '<li><b>所有声音都能当主角</b>：男女主下拉不再只列前 12 个，同性别的<b>一条不漏</b>（男 39 + 女 148，加主角两条共 {total} 个）。以前想把一个冷门声线设成主角，只能先把它挑成当前声线，绕一圈。</li>' +
      '<li><b>第一次打开会给 20 个推荐</b>：男 9、女 10、童 1，青年占四成，低沉只留一条。以前前八张卡全是低沉和中年男，还没滑到女声就把窗口关了。</li>' +
      '<li><b>旁白可以分男女两条</b>：同一本书适合女声娓娓道来，另一本可能适合男声沉稳。设置页和朗读条各有一个一键切换，两条各记各的，换书不用重新翻声线表。</li>' +
      '</ul>' +
      '<h3>1.14.35 改了什么</h3><ul>' +
      '<li><b>压缩包直接导入</b>：拖进来一个 .zip 就行——网上下的一整套 txt、资料包，解开后一本一本进书架，不用先手动解压再挑。只认书（TXT / EPUB / PDF / DOCX / MOBI / AZW3），压缩包里夹的图片、说明文件、Mac 的资源叉会自动跳过；GBK 老编码的 txt 也能正确读出来。解压只发生在内存里，不往你的文件夹写东西。</li>' +
      '<li><b>安卓念英文的节奏问题</b>：这次是「念一行、停很久、跳掉一大段、再念一行」。查出两个原因：① 英文切句沿用了中文标点表，英文句号不在里面，于是整段英文被当成一个巨型句子按字数硬切，<b>每一刀都落在单词中间</b>（This is a senten / ce that goes on），模型遇到半个词吐静音，连续两次就把英文熔断掉，后面的英文全跳过；② 前端判断英文能不能用，只看 /health 里的一个字段，而英文模型是后台加载的，页面启动那一刻必然是 false，之后不再刷新——于是英文块连预取都没做，每句都要播到跟前才现算。现在英文按 <code>. ! ?</code> 分句、按逗号分小句、按空格累加，绝不劈词；预取判据改成「没收到 415 就当可用」。另外开念时如果这一章有英文，会提前把模型建起来，不再等念到英文才发现要等几十秒。</li>' +
      '<li><b>英文引擎开多核</b>：以前钉死单线程，是误判——真正的死锁在 Java 分句循环里，跟线程数无关。现在按 CPU 核数开 2~4 路，真机上英文合成会快一些。</li>' +
      '</ul>' +
      '<h3>1.14.34 改了什么</h3><ul>' +
      '<li><b>整页扫描的书不再显示成一片水印</b>：有些扫描书被人塞了一层「加微信号领书」的文字，每页只有一句。以前只要全书字数过了门槛就当文字书打开，结果是满屏重复的水印，书本身一页都没显示。现在导入时先量每页<b>图像占多大</b>——整页都是一张图的页占多数、而每页文字少得可怜，就按扫描件打开，直接给你看原页。</li>' +
      '<li><b>导入提示说实话</b>：这种「有文字层但只有水印」的书，会明说「文件里那层字只有一句水印，不是正文，要听书得先做 OCR」，不再含糊成「没有文字层」。</li>' +
      '<li><b>安卓念英文的根因修掉了</b>：上一版把这个故障归到「两套模型并发互锁」，判断错了。真正的原因是 Java 里切分句子的循环——句末标点表里有半角句点 <code>.</code>，跳过标点的表里却没有，读到英文句号时下标原地不动，成了死循环。而这段循环<b>攥着旁白那把锁</b>，所以一句英文能把后面所有中文一起拖死。现在两张表对齐、并加了「没匹配上也必须前进」的兜底。模拟器实测：英文句 200 / 约 5 秒出音，念完英文中文照旧。</li>' +
      '</ul>' +
      '<h3>1.14.33 改了什么</h3><ul>' +
      '<li><b>DOCX 能读了</b>：Word / WPS 存的 .docx 直接导入，正文一个字不少（表格里的字也会按行读出来），章节按标题自动分。老版 .doc（97-2003 那种二进制格式）读不了，会直说「另存为 .docx」，不会硬塞一屏乱码进来。</li>' +
      '<li><b>MOBI / AZW3 能读了</b>：Kindle 的两种书都支持，自己解压、自己认章节，不装 Kindle、不联网。带 DRM 加密的会明确说「去掉 DRM 才能读」；少数用了 Kindle 私有压缩（HUFF）的暂时读不了，会告诉你先用 Calibre 转成 EPUB。</li>' +
      '<li><b>英文语音在手机上也开了</b>：模型重新打进包里，中英混排时按语言切开，汉字段用当前角色的声线，英文段交给英文模型，两边重采样后接回同一句。英文模型第一次用到才在后台建，建好了自动生效。</li>' +
      '</ul>' +
      '<h3>1.14.32 改了什么</h3><ul>' +
      '<li><b>扫描件 PDF 能导入、能看了</b>：整页是图片、没有文字层的 PDF（扫描的书、影印本、族谱、发票扫描），以前是当场拒收，说「要读得先做一遍 OCR」。现在按页渲染成图片放进阅读器：<b>翻页、目录（第 1 页…第 N 页）、进度条、书签、自动生成封面全都照常</b>，字清不清楚取决于扫描本身——阅读器不该替原件打折扣。</li>' +
      '<li><b>导入不再白等</b>：以前判定「有没有文字层」要先把整本书抽一遍，589 页的册子要等一分多钟才告诉你读不了。现在先抽前 12 页探一下，一页字都没有就直接按图片模式收进来，几秒钟就好。</li>' +
      '<li><b>说清楚哪部分做不到</b>：图片页上的字机器不认识，所以<b>不能朗读、不能划词、不能做笔记</b>——这一点主流阅读器也一样。点朗读会直说「这本是扫描件，只能看，念不了」，不会含糊成「引擎故障」。</li>' +
      '<li><b>图片页的交互按阅读习惯来</b>：点屏幕左右半边就是上一页 / 下一页，往后翻会提前把下一页画好，基本不用等；暗色主题下把白纸压暗一点，免得太刺眼（不做反相——反相会把照片和印章都毁了）。</li>' +
      '</ul>' +
      '<h3>1.14.31 改了什么</h3><ul>' +
      '<li><b>句子里夹一个英文词，不再整句跳过</b>：以前只要一句里出现 CPU、macOS、WiFi 这类词表里没有的英文词，语音这边会把整句判成「外文」退回来，朗读就直接跳过这一整句——中文书里夹英文词太常见了，一句话说没就没，确实不能接受。现在英文词单独念：认识的按词念，不认识的按字母念（C-P-U），中文一个字都不少。</li>' +
      '<li><b>老语音包也不会再丢句</b>：万一本机的语音包还是旧版，遇到这种句子会先抹掉英文词、把中文照念完，而不是整句留白。</li>' +
      '<li><b>桌面完整版内置英文语音</b>：EXE 里带了一套英文模型，中文书里的英文句子、英文段落都由它来念，音量与语速跟中文那副嗓子各算各的。轻量版 EXE 和纯网页版不带语音模型，自然也没有（它们本来就要配 VoicePack）。</li>' +
      '<li><b>安卓这一版先不带英文语音</b>：英文模型在安卓的 native 层会偶发卡死，而且一卡死连中文也跟着不出声——那比没有英文更糟。所以安卓先把英文词交给中文兜底（英文词跳过，中文一个字不少），等我拿真机把这条路测通再开。</li>' +
      '</ul>' +
      '<h3>1.14.30 改了什么</h3><ul>' +
      '<li><b>打开软件不再干等十几秒</b>：语音引擎每次冷启动都要重建推理会话，十几秒。以前是应用一起来就开始建，于是每次开软件都得等——可你打开软件多半只是在书架上翻一翻，根本没打算听。现在改成<b>打开一本书才建</b>：真要听的人，从翻开书到点朗读之间总归要翻两页，这十几秒就藏在那段时间里；只在书架停留的人，一次都不用等。</li>' +
      '<li><b>那句「首次约十几秒」改了</b>：它本来是错的——只有从安装包里解压模型才是一次性的，建会话每次都做。现在只说「约十几秒」，不骗人。</li>' +
      '<li><b>打开书时不再顺手把 187 人语音库也扛起来</b>：那份库光建会话就要二三十秒 CPU，正好撞上你刚翻开书、想点朗读的那一刻，第一句反而更慢。现在只在开始朗读、或者你点到配角声线时才热。</li>' +
      '</ul>' +
      '<h3>1.14.29 改了什么</h3><ul>' +
      '<li><b>换声线不再「没声音 + 弹窗」</b>：以前朗读中切声线，只要那一下合成没成，手机端就直接弹「语音没有出声」并停下朗读——切到配角声线时最容易碰上，因为 187 人语音库第一次要现解压、建会话，慢的时候半分钟。现在分清了「引擎还在准备」和「真坏了」：<b>还在准备就跳过这一句接着念，只轻提示一次</b>；这一段没出声也只丢这一句；真坏了（内存不够、模型起不来）才把自检摆出来。连着出不来 3 次才算坏，不是错一次就判死刑。</li>' +
      '<li><b>换声线时先说一声</b>：点到配角声线，如果语音库还没热，会写明白「187 人语音库正在准备，开头一两句可能跳过，好了自动接上」，不再让你盯着不动的朗读条猜。</li>' +
      '<li><b>配角库不再卡住整场朗读</b>：以前合成请求会同步等库装完（几十秒），页面等到超时就当失败。现在最多陪等 6 秒，等不到就明确回「还在装」，让这一句先过。</li>' +
      '<li><b>手动点配角也会预热</b>：以前只有开了「分角色朗读」才预热配角库，关掉它的人一点配角就是冷启动。现在点哪个声线就热哪个。</li>' +
      '<li><b>手机上不再出现「双击启动语音引擎.cmd」</b>：那是桌面版的提示，在手机上是胡说八道——而且它切过去的系统语音在安卓壳里是哑的，等于彻底没声音。手机端只弹自检卡。</li>' +
      '</ul>' +
      '<h3>1.14.28 改了什么</h3><ul>' +
      '<li><b>换台机器接着读</b>：设置里新增<b>网盘同步（WebDAV）</b>，填上网盘地址、账号和应用密码，进度、书签、批注、分组就在两台机器之间对上了。默认关闭，开了才联网。</li>' +
      '<li><b>不搬书，只对号</b>：每本书会算一个「内容指纹」（体积 + 书名 + 首尾各 8 KB 的摘要）。同一本书在另一台机器上再导一次，指纹一对上，进度自动接上——书文件一个字节都不用传，也不用等几十兆上传。旧书第一次同步前会自动补算。</li>' +
      '<li><b>两台都改过也不打架</b>：进度只许前进、不会倒退，章节跟着进度走；书签和批注两边都留下（按内容去重）；其余以最后读的那台为准。手写的笔记宁可多留，绝不覆盖。</li>' +
      '<li><b>应用密码只在本机</b>：密码单独存，不进设置、不进导出的备份，也不随同步上传。坚果云用「账户信息 → 安全选项 → 添加应用」生成的那个应用密码，别填登录密码。</li>' +
      '<li><b>网页版会直说用不了</b>：浏览器存不进网盘（跨域限制），设置里会写明要用桌面版或手机版，不让人填半天空欢喜。</li>' +
      '<li><b>它是实验性的，我把话说在前头</b>：协议层已经跑通——上传、读回、鉴权、拒绝错误密码全验过；但<b>还没在真实网盘上验证过</b>，因为手边没有网盘账号。所以它默认关着，你填完连不上、同步不上，都属正常，不是你的错。把现象留言给我，我照着修。愿意先试的人，才是这一版真正的测试者。</li>' +
      '<li><b>这一版要谢谢这些人</b>：@千杉、@云中书简、@ronin、@_城南。<br>' +
      '「书在两台机器上，读到哪儿了总接不上」——这句话是他们先说出来的，网盘同步就是照它做的。</li>' +
      '</ul>' +
      '<h3>1.14.27 改了什么</h3><ul>' +
      '<li><b>声线全部放开，只有原版男女主不可删</b>：以前六个音高变体跟着主角一起钉死，想只留听得顺的那一两个也不行。现在朗读条上固定的只剩「女声 1 · 原声」和「男声 1 · 原声」——它们是默认兜底，删了就没声音；其余包括六个变体、187 个配角、你自己挑的，都能删能加。</li>' +
      '<li><b>置顶位从 6 个放宽到 20 个</b>（女声、男声各 10）。删完想加回来不用先腾位置，也不会因为「满了」被拦住。</li>' +
      '<li><b>男声降噪默认改成「原声」</b>：实测手机喇叭外放时男声本来就清楚，那点「沙沙」要接功放或高解析耳机才明显，压过之后字会变闷，损失比收益大。接音箱时觉得吵，在<b>设置 → 免费神经语音 → 男声降噪</b>往上调一档即可，三档随时换。</li>' +
      '<li><b>说清一件事</b>：这套中性音色不合耳朵很正常。我们不做录音棚那种一尘不染的嗓子——<b>用普通人的声音，讲普通人的故事</b>，声音越普通，故事越有真实感。187 个人声，总有一个让你心动的声音。</li>' +
      '</ul>' +
      '<h3>1.14.26 改了什么</h3><ul>' +
      '<li><b>年份按年份念</b>：「2026上半年」以前念成「两千零二十六上半年」，现在念「二零二六上半年」。19xx / 20xx 四位数后接量词（2026人、2026元）仍按数值念，其余一律逐位——年份就该那么读。</li>' +
      '<li><b>日期整体认</b>：「2026-01-05」以前被拆成两个数、中间的连字符念不出来，现在整段念「二零二六年一月五日」；「2026-01-05 ~ 2026-06-30」念成「…到…」。</li>' +
      '<li><b>符号一律读出来</b>：这一版的底线是<b>常用符号宁可多读，绝不省略</b>——听书时听到「大于」「负」「美元」很正常，符号本身就带意思，漏一个可能把话读反。补上的有：正负号（-2.08 念「负二点零八」、+42,933 念「正四万二千九百三十三」）、大于小于、大于等于小于等于（≥ ≤）、不等于约等于（≠ ≈）、正负（±）、乘除（× ÷）、区间（3~5、60-52、1月5日-29日 念「到」）、箭头（→ 念「到」，← 念「从」，↑↓ 念「上升」「下降」）、千分号（‰）、摄氏与角度（℃ °）、货币（¥ $ € £）、井号（3#楼 念「三号楼」）、and（& 念「和」）、竖线（念停顿）、行首序号（2. 念「二、」）。</li>' +
      '<li>只有<b>标点</b>可以省，那是停顿不是语义；排版线（「====」「----」）也不算符号，不念。符号确实是运算符时才换字：<b>- </b>列表符号不动，A>=B 这种外文照样念「A大于等于B」，x-5 念「x减五」。</li>' +
      '</ul>' +
      '<h3>1.14.25 改了什么</h3><ul>' +
      '<li><b>PDF 能读了</b>：导入时选 PDF，会一页页把文字层抽出来，按章节排好——阅读、朗读、划词、笔记、繁简转换全都照常。抽出的正文跟书一起存在本机，第二次打开不再重解。扫描件（整页是图片）、字体没带 Unicode 映射的 PDF（抽出来只有乱码）会当场说清原因并跳过，不会塞一屏乱码进书架。</li>' +
      '<li><b>数字不再被吞</b>：以前「1934年4月13日」只念得出「年月日」，数字整段消失——配角库那 187 个说话人共用的模型没有数字规则。现在朗读前先把数字换成汉字：年月日、时刻（12:30）、百分比、金额、号段（手机号逐位念）、小数都对，跟用哪个声线、哪个平台无关。</li>' +
      '<li><b>朗读设置页多了「这本书的角色」</b>：一眼看到这本书认出了几个人物、用掉几个声线（还分女声男声）；旁边「识别一遍」可以当场重排，不用先点朗读。</li>' +
      '<li><b>英文书导入时说清楚</b>：手机版的离线语音没有英文模型，整本英文的书只能按语速留白。以前是静悄悄地不出声，现在导入完就明说，并告诉你桌面版装了英文模型能正常念。</li>' +
      '<li><b>体积</b>：PDF 用内置的 PDF.js（Apache-2.0）来解析，单文件 HTML 从 0.5 MB 变成 2.0 MB；APK / EXE 只多几百 KB（资源本身是压缩进包的）。</li>' +
      '</ul>' +
      '<h3>1.14.24 改了什么</h3><ul>' +
      '<li><b>男声可以降噪了，而且三档随你切</b>：有人反馈男声有「沙沙」的底噪。这确实是模型自带的——同一句话，男声字里的噪声只比语音低 7 dB，女声低 13.6 dB，所以同一层噪声在男声里会露出来。<b>设置 → 免费神经语音 → 男声降噪</b>，三档：<b>原声</b>（不处理）、<b>更干净</b>（压得彻底，代价是个别字略糊、整体偏闷）、<b>更清楚</b>（保住字头，压得稍轻）。默认「更干净」。</li>' +
      '<li><b>只作用于男声</b>：女声一个采样都不碰，处理前后字节完全相同。切档会从当前这句用新档位重念，方便直接对比。</li>' +
      '<li><b>说清一个取舍</b>：「闷」和「干净」在这个男声模型上没法两全。它 3~6 kHz 的语音能量只有 0.51%，女声是 2.13%，这是模型天生的，补高频补不出来——试过补 4.5 / 6.5 / 8.5 dB 三档，听感全变成齿音「擦擦擦」，所以一条都不留。只能在两个里选一个舒服的，现在交给你自己选。</li>' +
      '</ul>' +
      '<h3>1.14.23 改了什么</h3><ul>' +
      '<li><b>朗读条的声线可以自己攒了</b>：以前在设置里挑一个声线，朗读条最前面会出现它；再挑第二个，第一个就被挤掉了。现在改成<b>「我的声线」列表</b>——挑中哪个就加进去，<b>6 个位置，女声 3 个 + 男声 3 个</b>，男女各半，听书时两头都够用。存进本机配置，下次打开还在。不想要了，在设置里点它右边的 <b>×</b> 就从朗读条删掉。<b>删的只是朗读条那个下拉</b>，设置里 197 个声线一个不少，随时能再加回来。</li>' +
      '<li><b>主角那套是固定的</b>：原版男女声 + 8 个音高变体（女声 1~4、男声 1~4）永远在朗读条最上面，不能删——它们是默认音色，删了没兜底。</li>' +
      '<li><b>声线范围默认就是「全部 197 个」</b>：不用先切换一次才能看到别的音色。想省事就用「精选」，人工挑过的 21 个，名字和音高都对得上。</li>' +
      '<li><b>分角色不再跟着声线范围走</b>：以前把范围放到「全部」，分角色会顺手动用那 187 人的慢库，人多的书就开始等。现在多了一个「角色用全库声线」开关，默认关着，要更丰富的声音可以自己打开。</li>' +
      '</ul>' +
      '<h3>1.14.22 改了什么</h3><ul>' +
      '<li><b>几个声线的名字改对了</b>：有人反馈「精选里的男声听着不像青年」。我把 21 个精选声线逐个测了音高，确实标错了——「青年男 2」实测比「中年男 1」还低，「青年男 1」「青年男 3」也都在中年男区间，真正够青年的只有一个。现在按实测音高重新命名：中年男 4、男声 · 中音 1 / 2、青年男 1、女声 · 低音 1。<b>只改名字，声音一个字节都没动</b>，你之前选中的音色还是同一个。</li>' +
      '<li><b>朗读起不来时，能一键把诊断发给我</b>：报错弹窗里加了「复制诊断信息」，点一下就把版本、包类型、机型、引擎自检结果，以及<b>手机里到底装了几个中文语音</b>复制成一段文字。贴在评论里就行——以前这种情况要来回问三四轮，现在一次能定位。</li>' +
      '<li><b>「关于」页会交代这个包有什么</b>：最上面一行写清当前是哪个包、离线神经语音可不可用、手机系统朗读有几个引擎。如果装的是不含语音库的版本，就不用再照着完整版的说明去设置里白折腾了。</li>' +
      '</ul>' +
      '<h3>1.14.21 改了什么</h3><ul>' +
      '<li><b>手机选书时，列表里只剩 TXT 和 EPUB</b>：PDF、图片、压缩包不再排在眼前让人误点。之前为了让 epub 能显示，把类型过滤整个放开了，代价是列表里什么都有；现在换成「按类型白名单」——把 epub 在国产系统上可能被认成的那几种形态一并列上（<code>epub+zip</code>、<code>octet-stream</code>、<code>zip</code>），PDF 不在名单里，自然就不出现。</li>' +
      '<li><b>万一还是选到读不了的文件，不再弹「不支持这种格式」</b>：安静放过就好。只有一次都没导进来时才轻说一句，不把「格式不支持」摆到脸上。</li>' +
      '<li><b>这一版要谢谢这些人</b>：@momo、@点赞提醒你开了仅限好友评论区、@终端虫虫、@“青青子衿，悠悠我心”、@常清静矣、@小红薯、@生活吖、@Apple、@如月隐。<br>' +
      '「点下一页跳到下一章」「导入看不到 epub」「配角声线底噪和乱读」「安装包太大」——每一条都是他们先把现象说清楚，才定位得下去。</li>' +
      '</ul>' +
      '<h3>1.14.20 改了什么</h3><ul>' +
      '<li><b>桌面版（Windows EXE / 网页版）跟上手机版</b>：EPUB 导入、防跳章、导入文件夹这三处改的是同一份代码，之前只重打了手机包，桌面 EXE 还是上午的旧包。这一版两边一起出，行为一致。</li>' +
      '<li><b>PDF / MOBI 这类书不会再被当 TXT 硬塞进书架</b>：1.14.19 放开了文件筛选，所有文件都能看见，好处是 epub 终于能选；副作用是 PDF 也在眼前，若一律按 TXT 解码，就会导进一本满屏乱码的书。现在认不出来的格式直接跳过，并且写明是哪一本、为什么跳过。</li>' +
      '<li><b>桌面配角声线同样是半精度</b>：配角库 61 MB（原来 121 MB），字错率与合成速度不变。Windows 引擎实测：一句 4 秒的话合成 0.88 秒，速度没受影响。</li>' +
      '</ul>' +
      '<h3>1.14.19 改了什么</h3><ul>' +
      '<li><b>手机版终于能导入 EPUB 了</b>：以前点「导入书籍」，系统文件列表里根本看不到 epub —— 安卓的文件选择器按 MIME 类型筛，而 <code>.epub</code> 对应的 <code>application/epub+zip</code> 在不少国产系统（小米 / HyperOS、部分华为）的 MIME 库里没登记，于是目录里明明躺着 epub 却一个都不显示。现在不再按类型过滤，所有文件都能看见，认书的事交给墨吟自己判断。宣传里写的「能读 epub」，这次是真的能读。</li>' +
      '<li><b>文件名丢了后缀也能认出来</b>：有些文件管理器递过来的名字没有扩展名，以前会被判成「不支持」。现在会看文件头——EPUB 本质是 ZIP，开头一定是 <code>PK</code>，认得出来就按 EPUB 打开。</li>' +
      '<li><b>跳过的书会说清是哪一本、为什么</b>：以前只报「跳过 1 本（重复或不支持）」，等于没说。现在写明书名，重复的标注「书架已有」。</li>' +
      '<li><b>手机版「导入文件夹」变成真的选文件夹</b>：安卓的 WebView 不支持网页选目录，以前点下去只会弹出普通的多选框，还得自己进目录一层层挑。现在改用系统目录选择器，选一个文件夹，里面所有 TXT / EPUB（含子目录）一次扫出来，确认后批量入库。</li>' +
      '<li><b>「点下一页直接跳下一章」修了</b>：分页的页数是按内容位置算的，如果插图或字体还没加载完就测量，一章会被算成只有一页，于是一点「下一页」就跳章。现在会在插图加载完后复核一次页数，真到最后一页时也会再确认一遍，算少了就先补页，不会把整整一章跳过。</li>' +
      '</ul>' +
      '<h3>1.14.18 改了什么</h3><ul>' +
      '<li><b>安装包从 158 MB 回到约 104 MB，音质一点没退</b>：配角库换成<b>半精度（fp16）</b>存权重。之前试过的 int8 是「把每个数砍成 256 档」，砍掉的是精度，所以字会被念歪；fp16 只砍小数位、保留数值范围，实测<b>字错率 11.6%（原版 fp32 是 11~14%）、每句合成 1.01 秒（原版 1.00 秒）</b>，体积却只有一半。</li>' +
      '<li><b>说说还能怎么再小</b>：剩下的体积几乎全在语音库上（配角 61 MB、女主男主各 12 MB）。想压到 40 MB 以内，只有一条路——<b>把配角库从安装包里拿出去，第一次选用配角声线时再下载</b>。要不要这么做，等你试完这版再定。</li>' +
      '</ul>' +
      '<h3>1.14.17 改了什么</h3><ul>' +
      '<li><b>「每句有几个字囫囵吞枣」的根找到了，也认了账</b>：是语音库压缩得太狠。我用语音识别把合成结果转回文字，和原文逐字比对（20 句，走完整朗读链路）：<b>原版 fp32 字错率 11~14%，压缩过的 int8 版 23~26%</b> —— 也就是说每二十个字里就有四五个被念歪，正是你听到的「一串听不懂的字」。</li>' +
      '<li><b>换回原版 fp32，不再压缩</b>：把声码器、flow、文本编码器分别还原成 fp32 都试过，字错率还是 24% 上下 —— 失真是整层累积的，只有全 fp32 才能听清。代价是语音库从 41 MB 回到 121 MB，<b>安装包约 156 MB</b>（原来 76 MB）。这一步是拿体积换「听得清」。</li>' +
      '<li><b>顺带两个真 bug 也修了</b>：① 安卓端「声音太轻就抬起来」没有上限，峰值千分之一的片段会被放大 <b>700 倍</b>，等于把噪声顶到正常音量；现在先重念一次，还轻就把这几个字带到下一句，放大也封顶 4 倍。② 一句话不再按逗号切成 3~6 字的小块，改成按句号断（超过 34 字才在逗号处兜底），拼接点和淡入淡出少了一半多。</li>' +
      '<li><b>速度会慢一点</b>：配角声线每句约 1.5~2 秒（原来 0.5 秒），但引擎会把后面几句提前合成好，正常连着听基本感觉不到停顿。先前那个「快但听不清」的版本不再提供。</li>' +
      '</ul>' +
      '<h3>1.14.16 改了什么</h3><ul>' +
      '<li><b>「有几个字囫囵吞枣、听不清」修掉了</b>：安卓端有个「声音太轻就抬起来」的保险，本来是好意，但它没有上限 —— 遇到峰值只有千分之一的片段时会放大到 <b>700 倍</b>，把一小段几乎只剩噪声的波形顶到正常音量播出去，听感就是「一串听不懂的怪字」。现在改成：先重念一次（模型每次采样不同，第二次通常就正常了），两次都轻就把这几个字带到下一句去念，<b>不再放大噪声</b>；真要放大也封顶 4 倍。</li>' +
      '<li><b>一句不再被切碎</b>：以前按逗号断，一句话被拆成三四个 3~6 字的小块分别合成再拼起来，每块首尾都要淡入淡出，字音边缘被削掉一点，短块本身也是模型最不稳的地方。现在<b>按句号断</b>，一段就是一整句（超过 34 字才在逗号处兜底），拼接点少了一半多，语调也连着。</li>' +
      '<li>停顿仍然按标点分层（逗号 0.38 秒、句号 0.75 秒），只是改成由引擎自己念出段内停顿，句与句之间还是我们插。</li>' +
      '</ul>' +
      '<h3>1.14.15 改了什么</h3><ul>' +
      '<li><b>配角声线的「滋滋」底噪消掉了</b>：1.14.14 把量化方式换成静态量化后速度是快了，但压缩后的权重误差顺着声码器直接进了波形，听上去就是一层沙沙的高频嘶声。这次把最怕压的四类节点还原成 fp32 —— 输出层 <code>/dec/conv_post</code>、全部 LeakyRelu / Tanh / Div 激活、残差 Add、4 个转置卷积，其余照常压成 int8。谱平坦度从 0.42 降到 0.18（原版 fp32 是 0.15），6 kHz 以上能量从 6.6% 回到 3.2%，<b>和原版一模一样</b>。</li>' +
      '<li><b>没有拿速度换音质</b>：同一句话 0.26 秒，和上一版 0.25 秒基本持平，换段落照样是接得上的。</li>' +
      '<li><b>体积 33 → 41 MB</b>：只多这 8 MB，换来的是听感上没有量化痕迹。装好后首次启动会重新解压语音库（版本号 4→5），老文件不会带着旧模型跑。</li>' +
      '<li>顺手把安装器里的量化参数同步改了，用 <code>python VoicePack/install.py</code> 现装的也是这一版，不会再装回带嘶声的模型。</li>' +
      '</ul>' +
      '<h3>1.14.14 改了什么</h3><ul>' +
      '<li><b>配角声线「每换一段等半分钟」找到了</b>：不是缓存没留住，是那份 187 人语音库的 int8 模型有问题。当初为了省 80 MB，用「动态量化」把权重压成 int8，结果 189 个卷积层全变成了 ConvInteger —— 这种算子在 onnxruntime 的 CPU 后端只有参考实现，走不到优化内核。同一句话实测：原版 fp32 0.66 秒，动态量化版 12.9 秒，<b>慢了 20 倍</b>，换到手机上就是每段都要等半分钟。</li>' +
      '<li><b>换成静态量化（QDQ）</b>：卷积走 QLinearConv 的优化内核，同一句话 <b>12.9 秒 → 0.24 秒</b>，比原版 fp32 还快一倍多，体积只有 33 MB（原来 39.8 MB）。音色、语速都还是原来那 187 个人，声音没有换。</li>' +
      '<li><b>「正在准备语音库」只提示一次</b>：以前只要出现配角声线，每段超过 5 秒就弹一次，等于每段都被打断一次。现在只在语音库真的还没建好的那一次提示，热了就再也不弹。</li>' +
      '<li>顺手：安卓包反而小了约 7 MB（模型 39.8 → 33 MB），解压和建会话的时间也一起短了。</li>' +
      '</ul>' +
      '<h3>1.14.13 改了什么</h3><ul>' +
      '<li><b>187 个配角声线不再「点了没声音」</b>：配角库是一份 38 MB 的多说话人模型，第一次用要先把 51 MB 解到应用目录、再建推理会话，中端手机半分钟起步。以前是「点了才开始加载」，页面等 45 秒就判超时，看起来就是换声线全部失灵。现在应用启动三秒后就在后台悄悄把它热好，页面也把这一档的等待放宽到 150 秒，超过 5 秒还会提示「正在准备 187 人语音库」。</li>' +
      '<li><b>诊断看得更清楚</b>：「语音没有出声」那张卡片现在会写配角库是「就绪 / 加载用了几秒 / 加载失败的具体原因」，截图就能定位。</li>' +
      '<li><b>英文模型换了来源</b>：原来是 Piper 的 en_US，它必须带 espeak-ng 前端，而 espeak-ng 是 GPLv3、新版 sherpa-onnx 已经不再编进 Windows 包，装了也报 no frontend available。改用 icefall 的 vits-ljs（LJSpeech，Apache-2.0，自带音素词典），装好之后 WiFi / iPhone / GDP 这些词真能念出来。装法：<code>python VoicePack/install.py --en</code>。</li>' +
      '</ul>' +
      '<h3>1.14.12 改了什么</h3><ul>' +
      '<li><b>手机上顶栏从两行压成一行</b>：以前「返回 / 书名 / 时钟」占一行，五个大按钮再占一行 44px，加起来一百多像素，一屏幕正文被吃掉一大块。现在一行放下 返回、书名、时钟、目录、朗读、⋯，高度减半；搜索、排版、书签、笔记、主题、自动、全屏、设置都收进「⋯」，点开是一个浮在正文上的面板，<b>不会把顶栏再撑高</b>。</li>' +
      '<li><b>工具栏可以收起来了</b>：点屏幕中间，上下两条工具栏一起滑走，正文占满整屏；再点中间，或者点屏幕最上面那条窄边，就唤回来。收起后仍停在原来那一页，不会跳。</li>' +
      '<li><b>默认就是翻页，点一下就翻</b>：手机没有键盘也没有滚轮，以前得靠左右滑，划得手指累。现在点屏幕<b>右边三分之一</b>翻下一页、<b>左边三分之一</b>翻上一页，中间那块留给选字、点链接、点「朗读从这里念」。到章末会自动接下一章。</li>' +
      '<li><b>老用户不会被硬改</b>：只有从没动过「阅读方式」的配置才跟着切到翻页；自己选过滚动的，保持滚动，设置和排版面板里随时能切回来。</li>' +
      '<li><b>顺手</b>：窄屏顶栏的时钟只显示时:分，把宽度让给书名；翻页模式底部多留一点白，最后一行不再贴住屏幕下沿。</li>' +
      '</ul>' +
      '<h3>1.14.11 改了什么</h3><ul>' +
      '<li><b>念到英文不再报错、不再切回系统语音</b>：三份中文模型的词典里一个英文字母都没有（实测 68 012 条词条，连 hello / OK / CPU 都查不到），整段英文送进去就是「一个字都没念出来」，旧版会报 HTTP 500 并退回系统朗读。</li>' +
      '<li><b>现在这样处理</b>：纯英文（一个汉字都没有）的句子，交给系统英文语音念——语言换了，声音本来就不该是同一副；机器上没有英文语音就按字母数留一段空白（最长 4.5 秒）再往下念，只轻提示一次，不弹窗、不算失败、不降级。<b>中英混排</b>（「他打开 iPhone 看了一眼」）照常用人物的声音念中文，英文单词按语言切开后交给英文模型补上（需 VoicePack/models/en-ljs，可选装，约 40 MB；没装则那一个词略过，中文不受影响）。</li>' +
      '<li><b>安卓端不再为一段英文弹「语音没有出声」</b>：手机壳里的中文模型同样不认字母，以前一段英文就会弹诊断窗、整场朗读停在那儿。现在这类句子按语速留白跳过，接着念下一句。</li>' +
      '<li><b>纯符号、开头几句的修正都保留</b>：1.14.10 那三处（「？？？」按长度留白、单句失败只跳这一句、开头先等引擎 8 秒）一个没动。</li>' +
      '</ul>' +
      '<h3>1.14.10 改了什么</h3><ul>' +
      '<li><b>念到「？？？」不再忽然换成系统语音</b>：这种整段只有标点的地方，本来就没有一个字可以念，引擎会判成空文本（HTTP 500 empty text），页面一收到就当引擎坏了、切回系统朗读——听感上就是「念到问号忽然换了个人」。现在按符号长度留一段安静（一个问号约 0.3 秒，最多 0.8 秒），后面照常用原来的人物声音念下去。</li>' +
      '<li><b>一句没合成出来，只跳这一句</b>：多角色朗读最怕中途换嗓子。现在单句失败只丢那一句，接着念下一句，段里其它内容不受影响；只有连不上引擎、或者连着好几段都出不来，才退回系统朗读。</li>' +
      '<li><b>刚打开软件就点朗读，开头不再变成机械音</b>：此前页面一进去就探一次引擎，那时它往往还没解压完模型，探不到就用系统语音念掉开头几句；十几秒后又恢复，同一段话两种嗓子。现在点朗读会先等引擎最多 8 秒，等到了就用神经语音从头念。万一真的退回了系统语音，这一场朗读就一直用它，不在半路换回来（下次点朗读再重试）。</li>' +
      '<li><b>服务端兜底</b>：任何只有标点、没有可念字的请求，返回等长静音而不是报错，旧版页面也不会再被这一下吓回系统语音。</li>' +
      '</ul>' +
      '<h3>1.14.9 改了什么</h3><ul>' +
      '<li><b>一个人只有一个声音了</b>：以前是「谁先开口，谁就从声线池里挑一个还没被用过的」，于是同一个人在不同段落被认成不同写法（赵长河 / 他 / 赵长河道），各抢一条声线；认不出说话人那句又再抢一条。听感就是一段两人对话里男女声来回跳。这一版改成<b>先定人、再开口</b>：开始朗读前先把这一章连同前后各两章（第一次读这本书还会加上开篇三章）里说过话的人全扫一遍，按戏份排好，一次性把声线定死，并写进书里，下次打开还是这些声音。</li>' +
      '<li><b>「他 / 她」不再算新人物</b>：代词现在会绑到本段最近提到的那位同性别角色，绑不上就用这一场在场的那位。以前「女子」和「她」各配一个女声，同一段里一个人两种嗓子，就是这么来的。</li>' +
      '<li><b>认不出是谁的那句不换声</b>：改成沿用上一位的声音。以前这里会挑一个「用得最少」的声线，每句换一个，最刺耳。<b>只有真的换了人</b>（上一句明确是别人、两句紧挨着）才跟着换。</li>' +
      '<li><b>「他平静回应：」这种归属句用他自己的声音</b>：带说话动词或引来对白的冒号小句，跟着那个人走，不会在一个人说话中间硬插进旁白的嗓子；纯动作描写（「她抬头看了一眼窗外。」）仍然归旁白。</li>' +
      '<li><b>不再自动用到慢声线</b>：人物一多，旧逻辑会自动扩到那 187 人的慢库，一句要十几秒。现在只在「声线范围」里主动选「全部」时才动用，人物多出来就共用快声线。</li>' +
      '</ul>' +
      '<h3>1.14.8 改了什么</h3><ul>' +
      '<li><b>对话前等十几秒的毛病，根子找到了</b>：电脑版以前的语音是「一句话起一个进程」，引擎光是启动、把模型读进内存就要 1.9 秒，一段对白十几个短句，排着队合成就是九秒、十秒。实测数据就摆在那儿：长段 9.9 秒，短句也要 1.9 秒。这一版把模型改成<b>常驻内存</b>，加载一次反复用，同样那一段 <b>9.9 秒 → 2.7 秒</b>，短句 <b>1.9 秒 → 0.19 秒</b>。</li>' +
      '<li><b>配角声线换成 8 个快的</b>：原来那 187 人的配角库音色最自然，但推理慢二十倍——一句二十字要十二秒以上，只要配角一开口就必然干等。现在改用男女主角两份 22 kHz 模型各做四个音高变体（低沉／原声／沉稳／明亮），一句二十字约 0.5 秒。代价说明白：配角之间的音色差别不如原来那 187 人明显，但每个角色仍然固定一个声音，男女绝不会搞反。想换回旧音色，在语音下拉里选带「音色 N」字样的仍在。</li>' +
      '<li><b>整章先排好，播到哪儿都不断</b>：开始朗读时就把后面几段的对白分析完、句子切好、声音定死，然后按播放顺序一句一句提前合成。以前是「这一段播完了才开始合成下一段」，现在是一边播一边备，换段、换人都是无缝的。</li>' +
      '<li><b>认人更准了</b>：修好三类最容易配错性别的句子——「赵长河忽然开口」「女子平静回应」（名字后面隔着一层状语，旧版会把「赵长河忽」「女子平」当人名），以及「女子头也不抬，似是知道他的到来：」这种主语在整句最前面、冒号前全是动作神态的句子。另外一问一答里没写是谁说的那对引号，会按「上句是女声，这句就换男声」来判，不再一律当旁白。</li>' +
      '</ul>' +
      '<h3>1.14.7 改了什么</h3><ul>' +
      '<li><b>角色开口前不再干等</b>：分角色时旁白与对白用的是两套模型，旧版把两套合成排成一个队，还只预取下一句——上一句快播完了才轮到合成角色那句，听感就是每次换声都卡一下。现在提前两段排队，两套模型各自并行合成，换声那句往往在上上句还在播时就备好了。</li>' +
      '<li><b>第一个角色不再等十几秒</b>：配角库（187 人那份 38 MB 模型）原来要等第一次对白才解压。现在开始朗读时就先把它预热，藏在开头几句旁白里。</li>' +
      '<li><b>男女声不会再配反</b>：修掉「张三对她说」被认成「她说的」——这类句子以前会把听话人当说话人，于是男角色一开口就是女声。同时按名字用字判断性别（阿芳 / 王强），并从上下文里的「他 / 她」认人，认一次整本书沿用；「我说」直接用旁白的声音，第一人称书里不会凭空多出一个人。</li>' +
      '<li><b>配错了会自己改</b>：万一先前没认出性别、随手配了一个，后面认出来了而声音跟性别对不上，会自动换掉，不会让男角色一直用女声。</li>' +
      '</ul>' +
      '<h3>1.14.6 改了什么</h3><ul>' +
      '<li><b>点朗读终于会出声了</b>：安卓的系统浏览器内核里根本没有网页朗读接口，程序一直拿它当前置条件。于是「手机自带的语音引擎明明已经连上」，一点朗读还是被拦回去弹「引擎已连上，再点一次朗读」；再点一次，还是同一句。现在只要本机语音引擎就绪就直接读，不再依赖那个不存在的接口。</li>' +
      '<li><b>合成失败会说实话</b>：以前失败时只在屏幕底部闪一条 6 秒的小字，还会悄悄退回手机系统语音（那个是哑的）。现在弹一个能看清的对话框，里面直接写引擎给的原因和自检结果，截图就能定位。</li>' +
      '<li><b>声音很轻的片段会被抬起来</b>：压缩过的模型偶尔输出峰值很低的波形，旧版当成「没出声」整段丢掉。现在先把它抬到正常音量再播，不会再有整段空白。</li>' +
      '<li><b>加载完先自动试合成一句</b>：把推理会话提前热起来，也顺手检查引擎到底能不能出声。</li>' +
      '</ul>' +
      '<h3>1.14.5 改了什么</h3><ul>' +
      '<li><b>点朗读不再误报「手机没有中文语音」</b>：安卓版第一次启动要先把十几 MB 的语音模型解压好，这段时间引擎还没就绪。旧版只探一次（2.2 秒就超时），探不到就立刻回退到系统语音，再弹出一条「这台手机没有可用的中文语音」——可你自己的引擎往往下一秒就好了，等于冤枉了手机。现在会一直等到引擎就绪（最多 60 秒），期间只提示「正在准备语音引擎」。</li>' +
      '<li><b>第一段朗读放宽到 90 秒</b>：手机上第一句要现建推理会话，慢的时候三十秒都打不住，旧版 30 秒就判超时。第一段成功后回到 45 秒。</li>' +
      '<li><b>真的失败时说人话</b>：安卓壳里的系统语音其实是哑的，切过去等于没声音。现在合成失败会直说「这一段没合成出来」，不再假装已经切到系统朗读。</li>' +
      '<li><b>状态探测从 2.2 秒放宽到 4 秒</b>：引擎解压时机器很忙，状态接口偶尔要两三秒才回，超时就会被误判成「没连上」。</li>' +
      '</ul>' +
      '<h3>1.14.4 改了什么</h3><ul>' +
      '<li><b>修好安卓端点图标黄屏、反复闪退</b>：1.14 给手机加了离线神经语音，引擎启动时把解压后的模型用「文件绝对路径」喂进去，却顺手把安卓的资源管理器（AssetManager）也传了。引擎看到资源管理器就以为路径是包内的相对路径，去包里找 <code>model.onnx</code>，当然找不到；而那段代码在底层库（native）里没有异常保护，找不到的那一刻整个进程被直接终止——所以手机上既没有弹窗、也没有报错，只有一片窗口底色，系统又把界面反复拉起来。现在改成只走文件路径，模型加载、建引擎都正常了。</li>' +
      '<li><b>语音改成界面画好之后才加载</b>：以前是一进 App 就和浏览器内核同时去加载几十 MB 的底层库，部分机型会因此卡死在启动。现在先让你看到书架，约 9 秒后再在后台准备语音，朗读之前就绪。</li>' +
      '<li><b>只有安卓包受影响</b>：电脑版、网页版走的是本机 Python 语音服务，没有这段代码，此前各版一直正常。</li>' +
      '</ul>' +
      '<h3>1.14.1 改了什么</h3><ul>' +
      '<li><b>修好安卓端点朗读弹「语音引擎没能启动」</b>：1.14.0 的安卓包里，引擎配置只用得上 VITS 一种声音模型，剩下六种（matcha、kokoro 等）当初图省事填了空值。新版引擎库把这几个位置声明成「不许为空」，于是在建配置的那一刻就抛异常，模型连加载都没轮到——报告里的 <b>NullPointerException ... parameter matcha</b> 就是这一句。现在改成填空对象，已用同一份引擎库在本机复现报错并验证通过。</li>' +
      '<li><b>只有安卓包需要换</b>：电脑版和网页版走的是本机 Python 语音服务，压根没有这个配置类，不受影响。</li>' +
      '<li><b>万一还有别的错</b>：弹窗里「先用手机自带的中文语音顶上」那条建议依然有效，可以先听着，把新弹窗的报错原文发过来。</li>' +
      '</ul>' +
      '<h3>1.14 改了什么</h3><ul>' +
      '<li><b>男主、女主都换成 22.05 kHz</b>：以前只有女声是高清，男声只能从配角库里挑，听着发闷发远。现在男女主角各有一份 22.05 kHz 的模型，配角库也升到 16 kHz——原来 4 kHz 以上整段是空的，现在是真实的高频。</li>' +
      '<li><b>187 个配角，按年龄层分组挑</b>：老生、中年男、青年男、沉稳女、成年女、青年女、童声共七档，每档都有几个人可选，档内按音高排好。它们全部来自同一份模型，放开多少个都不增加体积。</li>' +
      '<li><b>音色库换血</b>：8 kHz 的 174 人库整个删掉，换成 16 kHz 的 187 人库，男声从 26 个变成 37 个。代价要说白：配角合成慢一些，所以它只当配角，男女主角和旁白不受影响。</li>' +
      '<li><b>安装包反而小了</b>：83.7 MB → 约 70 MB。主角换成的 int8 模型能被压缩，而原来那份 60 MB 的浮点模型几乎压不动，在包里是原样存的。</li>' +
      '<li><b>修掉一处音色标错</b>：上一版把几个男声标成了「成年女」，因为它按基频推断性别，男低音会被算高一个八度。这一版按音高重新分档，并逐条听过校准。</li>' +
      '</ul>' +
      '<h3>1.13 改了什么</h3><ul>' +
      '<li><b>换成更清楚的女声</b>：以前的语音是 8 kHz，4 kHz 以上的声音整段被砍掉，听感像电话。现在默认音色换成 22.05 kHz 的模型，采样率高了近三倍，齿音、气口、尾音收束都回来了，句子里哪轻哪重也听得出来。停顿规则原样沿用上一版调好的那套（逗号 0.35 秒、句号 0.74 秒）。</li>' +
      '<li><b>174 个声线一个没少，男声也在</b>：新女声只占「声线范围」里多出来的一个位置，原来的 174 个中文说话人（148 女 + 26 男）全部保留。想换口味或听男声，照旧在设置里放开「全部 174 个」。</li>' +
      '<li><b>音色库从 29 MB 压到 14 MB</b>：同一份 AISHELL3 模型，说话人编号分毫不动，只把权重从 32 位浮点压成 8 位整数，体积减半、音质只差一点。代价要说明白：选中老声线时合成会慢一些（实测同一句话 0.2 秒变 3 秒），所以它只当「换口味」用，日常听书走默认的新女声，速度不受影响。</li>' +
      '<li><b>安装包约 82 MB</b>：默认女声 60 MB + 音色库 14 MB + 引擎。想省体积可以只要默认女声（约 68 MB），但那就是在设置里看不到 174 个声线了。</li>' +
      '</ul>' +
      '<h3>1.12.2 改了什么</h3><ul>' +
      '<li><b>逗号真的会停了</b>：上一版只把引擎的「停顿倍率」调大，可它是连字与字之间的空隙一起放大，所以逗号还是淹没在空白里——这点上一版判断错了。这一版改成按人念书的规律分四级：顿号 0.26 秒、逗号 0.35 秒、句号 0.74 秒、段落 1.1 秒，问号和省略号更长。实测句号是逗号的 2.1 倍，层次才听得出来。</li>' +
      '<li><b>去掉每句前后多余的空白</b>：引擎在每个小句的首尾都自带 0.1~0.3 秒无声，叠起来就是句句之间白多出半秒。现在裁掉了，整段紧凑约四分之一，节奏不再拖沓。</li>' +
      '<li><b>短句不再吞字</b>：一两个字的短句单独送去合成，常常返回一段近乎无声的波形（「墨水」峰值只有 2，而「笔」是 1146）。现在每句合完都检查到底出没出声，没出声就并进前后文重新合成，书里不会再有莫名其妙的空白。</li>' +
      '<li><b>换行不再干等</b>：修好了预取失效的老问题——原来是先作废上一段再取预取结果，等于每段都在现合成。现在换段先把第一句送去合成，翻段几乎立刻出声。</li>' +
      '<li><b>长句从容、短句利落</b>：按句子长短给了 ±3% 的语速差，句末再慢一点收住，免得每句都一个速度念到底。</li>' +
      '</ul>' +
      '<h3>1.12.1 改了什么</h3><ul>' +
      '<li><b>朗读终于会断句了</b>：神经语音的句间停顿以前被压到引擎默认的五分之一，句号处只剩 0.1 秒，一整段念下来像一口气读完，只有换行（换段）才听得出停。现在恢复到引擎基准，句号处 0.5~0.9 秒、逗号仍很短，听感才接近念书。电脑版和安卓版都改了。</li>' +
      '</ul>' +
      '<h3>1.12 改了什么</h3><ul>' +
      '<li><b>能查新版本了，但依然默认不联网</b>：阅读设置里多了「检查更新」，点一下才去读一次版本清单（约 90 KB，只说「我要最新版号」，不传任何本机信息、不传书、不传阅读记录）。有新版本会写清你这台设备该下哪个包、多大、sha256 是多少。<b>「启动时自动查新」默认是关的</b>，要开自己在设置里开，开了也一天最多查一次；断网时它会彻底安静，不会弹窗打扰看书。</li>' +
      '<li><b>版本号从此一一对得上</b>：页面、Windows、Linux、deb、安卓包的版本号以前分五处手写，出现过「窗口标题 1.10.2、页面里 1.11」这种对不上的情况。现在由一处统一生成，安卓的 versionCode 也按版本号推算（1.12.0 → 11200），任何一个包都能对回同一个版本。</li>' +
      '<li><b>下载走哪条线由实测决定</b>：新版本的下载会优先走实测最快的那条镜像，GitHub 原站慢或断了也能下得动。</li></ul>' +
      '<h3>1.11 改了什么</h3><ul>' +
      '<li><b>手机也有 174 个离线神经声线了</b>：以前只有电脑能听到 sherpa-onnx + AISHELL3 那套神经语音，手机上只能用安卓自带的机械音。现在引擎和模型直接装进了安卓包，断网、飞行模式照样能听，音色、音高分组、分角色朗读和电脑端完全一致。</li>' +
      '<li><b>顶栏不再挤成三行小格子</b>：手机上只留目录、搜索、排版、朗读四个常用键，每格 44px 高、字也大了一号；书签、笔记、主题、自动、全屏、设置收进「⋯」，点开就有，点一下动作自动收起。</li>' +
      '<li><b>手机上第一次打开就是顺眼的排版</b>：字号 18px、行距 1.9、左右各留 18px（原来照搬桌面 32px，屏窄时一行剩不到二十字）。只影响「从没调过设置」的新用户，调过就完全听你的。</li></ul>' +
      '<h3>1.10.3 改了什么</h3><ul>' +
      '<li><b>手机上点一下就能翻页</b>：手机没有键盘和滚轮，以前只能一直用手指滑。现在轻点屏幕左侧 22% 回上一屏、右侧 22% 翻下一屏，中间留给选字、链接和「朗读从这里念」；手指滑动过就不算轻点，不会误翻。</li>' +
      '<li><b>朗读提示不再答非所问</b>：以前在手机上点朗读只会弹一句「当前浏览器不支持朗读，请用新版 Edge / Chrome」——手机上根本没有 Edge 可装。现在分开说：安卓浏览器里提示装安卓版并给可复制的直链；安卓版里如果缺中文语音，会告诉你具体去系统哪个设置、装哪个引擎，并带「再试一次」。</li>' +
      '<li>安卓版语音桥加固：等页面初始化的时间从 12 秒放宽到 60 秒（首次打开要建本地库，慢一点以前会永远连不上）；系统语音引擎初始化慢时自动重探，装好中文语音后点「再试一次」即可生效，不用重启应用。</li></ul>' +
      '<h3>1.10.2 改了什么</h3><ul>' +
      '<li><b>繁简转换</b>：设置里「繁简」可选「原文 / 简体」。看台版书、古籍时打开，正文和目录一起变简体；<strong>只改显示，书里的原文一个字都不动</strong>，关掉就还原。用的是 OpenCC 的对照表（2965 个一对一常用字），而且是等长替换，所以划线、笔记、朗读的位置都不会错。</li>' +
      '<li><b>点插图看大图</b>：EPUB 里的地图、人物关系表、插图页以前只能看缩略图，现在点一下全屏看，点任意处或按 Esc 关闭。</li>' +
      '<li><b>双指捏合调字号</b>：手机上不用再进设置，两指一捏就调，松手自动保存。</li>' +
      '<li><b>Linux 有了 .deb 安装包</b>：双击安装就进应用菜单，比解压 tar.gz 再跑脚本省事。卸载走系统正常的卸载流程。</li>' +
      '<li>修：macOS 的打包脚本不再强制安装 pywebview（装不上也不会中断，程序会自动改用浏览器窗口）。</li></ul>' +
      '<h3>1.10.1 改了什么</h3><ul>' +
      '<li><b>Linux / 信创版有真程序了</b>：不再只是「网页 + 启动脚本」，而是一个 10 MB 的独立可执行文件，双击就跑，<strong>不需要装 Python、不需要装任何依赖</strong>。已在统信 UOS 20 专业版（x86_64）上实测：书架、导入、翻页、主题全部正常。</li>' +
      '<li>只依赖系统自带的 libc / libz / libpthread（glibc 2.28+），UOS 20、银河麒麟 V10、openEuler 20.03 及更新版本都能直接运行。</li>' +
      '<li>窗口用的是系统浏览器内核的「应用模式」：没有地址栏和标签页，是一个独立窗口；关掉窗口程序就退出。</li>' +
      '<li>飞腾 / 鲲鹏（aarch64）、龙芯（loongarch64）这类架构仍走 Python 或网页方式，包里附了 build-linux.sh 可在本机打自己的二进制。</li></ul>' +
      '<h3>1.10 改了什么</h3><ul>' +
      '<li><b>拖进来就能导入</b>：把 TXT / EPUB（或整个文件夹里的书）直接拖到窗口上，松手就开始导入，不用先点「导入」再翻目录。正在看书时拖也不打断，导入完成后回书架就能看到。</li>' +
      '<li><b>记住窗口大小和位置</b>：下次打开还是你上次调好的样子，不用每次重新拉窗口。</li>' +
      '<li><b>目录能搜了</b>：长书几百章，侧栏「目录」顶部有搜索框，输关键字即时过滤，还能看到命中多少章。</li>' +
      '<li><b>字重可选</b>：细 / 常规 / 中粗 / 粗，中文正文看久了换一档会更顺眼。</li>' +
      '<li><b>能装在 Linux / 信创 / macOS 上了</b>：另附两个包，解压双击即用，不用装 Python。</li></ul>' +
      '<h3>1.9.6 改了什么</h3><ul>' +
      '<li><b>自动翻页的停留时间可以自己定了</b>：以前默认写死 20 秒，滑杆藏在「排版」面板里、范围只有 4–60 秒还得两秒一跳。现在「设置」第一屏就有「自动阅读」一段：<strong>翻页停留 3–180 秒</strong>（步长 1 秒）、滚动速度 1–10，旁边还有「现在开始」按钮。正在自动翻页时拖动秒数，会立刻按新间隔重新计时，不用关掉重开。</li></ul>' +
      '<h3>1.9.5 改了什么</h3><ul>' +
      '<li><b>字体 5 种 → 10 种</b>：宋体 / 雅黑 / 黑体 / 楷体 / 仿宋 / 中宋 / 隶书 / 幼圆 / 等线 / 等宽。每个按钮用<strong>它自己的字体</strong>渲染，挑之前就能看出差别。</li>' +
      '<li><b>颜色丰富了</b>：字色 8 个常用色（墨黑 / 烟灰 / 深棕 / 赭石 / 藏青 / 墨绿 / 暗红 / 紫棠），底色 8 个（纸白 / 米黄 / 羊皮 / 豆绿 / 浅蓝 / 藕粉 / 暖灰 / 深灰），点一下就用，仍可自己取色。选深色底时字色会自动调浅，不会糊成一片。</li>' +
      '<li><b>书里人多也不怕</b>：以前角色声线池是「精选 11 个」，人一多就撞声。现在人物数超过手头声线时会自动扩到全部 174 个——实测 20 个人物能分到 19 个不同声音。设置里能看到「这本书已认出 N 个人物，用掉 M 个声线」。</li></ul>' +
      '<h3>1.9.4 改了什么</h3><ul>' +
      '<li><b>设置里直接能调字号、行距、字体、颜色</b>：以前「字号 / 字体 / 配色」全在「排版」面板里，设置里只剩一个跳板，找起来绕。现在设置第一屏就有：字号 A−/A+ 与滑块、行距滑块、五种字体（宋体 / 黑体 / 楷体 / 仿宋 / 等宽）、字色与底色两个取色器（配「跟随主题」一键还原）、六套主题一键切换。更细的（段距 / 字距 / 首行缩进 / 分栏 / 翻页动画 / 版心 / 亮度 / 自动阅读）仍在「排版」面板。</li>' +
      '<li><b>分角色朗读默认开启，而且认得准了</b>：以前只有「张三说：」这种紧贴人名的写法才认得出，像「他盯我一眼，说：」「我说：」「他突然问我：」这类最常见的写法全被当成旁白，于是整段一个声音——看起来像没生效。现在能认出这几类主语，也修掉了「我对俞猴子说」把听话人当说话人的错误。分角色从此默认开（有神经语音引擎时生效；没引擎会明确提示，不再让人以为坏了）。</li></ul>' +
      '<h3>1.9.3 修了什么</h3><ul>' +
      '<li><b>翻页不再「只剩一条窄栏 + 右边一片黑」</b>：翻页时正文盒自己带了裁切，平移过去的内容被自己剪掉，第 2 页起容易整页空白；同时开合侧栏后没有重新分页，还按旧列宽平移，一翻页就停在半截列上。现在裁切交给外层容器，正文盒只负责排版；侧栏开合、进入沉浸、窗口缩放都会自动重新量一次列宽与页数。</li>' +
      '<li><b>版心宽度在翻页时也生效</b>：宽度限制从正文盒挪到了外层容器，双栏在 1920 宽的屏上是两栏各 688px、整体居中，不再把溢出的第三列露在留白里。</li></ul>' +
      '<h3>1.9.2 新加了什么</h3><ul>' +
      '<li><b>网络位置导入（SMB）</b>：书架多了「网络位置」，填 <code>\\\\192.168.1.10\\Books</code> 这样的局域网共享、映射好的网盘（<code>Z:\\书</code>）或本机任意绝对路径，就能像本地文件夹一样扫描导入。凭据交给 Windows 记着——资源管理器里能打开，这里就能读，不用先把书拷过来。连不上的主机 12 秒内给提示，不会一直转。</li></ul>' +
      '<h3>1.9.1 修了什么</h3><ul>' +
      '<li><b>章末最后一页不再「只剩左半边」</b>：双栏翻到一章结尾时，总页数被少算，剩下的列挤在最后一页左半边、后面的内容甚至翻不到。现在按真实列数算页数，末页会把剩下的内容排满，并在右栏显示「本章完 · 下一章」。</li></ul>' +
      '<h3>1.9 新加了什么</h3><ul>' +
      '<li><b>分栏只有两种</b>：单栏和双栏，不做 3 栏 4 栏那种容易读花的东西。排版面板里「分栏」是「自动 / 1 / 2」，自动按屏宽决定（够宽就双栏），也能自己锁定；手机上永远单栏，点双栏会自动切到翻页。</li>' +
      '<li><b>主题按钮改成弹面板</b>：以前按一下换一档，得来回点好几次；现在点「主题」直接列出六套配色，每张卡片就是那套主题的底色和字色，选好即生效，面板不关，可以一张张比。</li>' +
      '<li><b>「设置」常驻顶栏</b>：阅读界面的按钮组最后多了「设置」，任何时候都能打开完整设置；手机上按钮排成两行，不会被挤掉。</li>' +
      '<li><b>阅读时钟</b>：顶栏显示当前时间与本次已读时长，读满 30 分钟转黄、60 分钟转红；沉浸模式下右上角留一个淡时钟。点一下可以开关、也可以重新计时。</li>' +
      '<li><b>休息提醒</b>：连续读满设定时长（默认 45 分钟，可设 30 / 45 / 60 / 90 或关闭）会浮出一条提示，选「休息一下」重新计时，或「稍后再提」十分钟后再来。时长只算真正在读的时间，回书架、切走窗口都会停表。</li>' +
      '<li><b>翻页不再出「半列」</b>：一屏的步长改成按实测列距计算，浏览器万一多排了半列也会被立刻纠正。</li></ul>' +
      '<h3>1.8 新加了什么：把版式做到能和成熟阅读软件掰手腕</h3><ul>' +
      '<li><b>翻页阅读</b>：除了一直有的滚动，新增整屏翻页。宽屏 / 平板自动左右<b>双栏</b>，手机<b>单栏</b>；点屏幕左右两侧、滚轮、空格、← → 、手机上左右滑都能翻，翻页动画可选滑动 / 淡入 / 无。</li>' +
      '<li><b>排版面板</b>：顶栏「排版」一处集中管理——字号（A− / A+ / 滑块）、行距、段间距、字间距、首行缩进、五种字体（宋体 / 黑体 / 楷体 / 仿宋 / 等宽）、两端或左对齐、版心宽度与左右页边距，底部一键恢复默认。</li>' +
      '<li><b>六套主题</b>：夜间、明亮、羊皮纸，新增<b>护眼绿、雾蓝、纯黑</b>；还能自己挑底色与字色，选完不合适当场清空回主题。夜间另有一层「亮度」压暗，黑灯下不刺眼。</li>' +
      '<li><b>自动阅读</b>：滚动模式匀速下滚，翻页模式按秒自动翻页；一键暂停 / 继续，暂停时留个小胶囊，到章末自动接下一章。</li>' +
      '<li><b>沉浸全屏</b>：一键收起上下工具栏，鼠标移到屏幕上缘或下缘再唤出；F11 或顶栏「全屏」都行，Esc 依次退出工具栏 / 自动阅读 / 全屏。</li>' +
      '<li><b>顺带修掉的老毛病</b>：书里自带的 <code>body{margin:5%}</code> 之类的样式会窜进正文、把版心挤歪（双栏因此右栏被切），现在书只能管自己段落里的样式，版心与字号一律听你的；正文里那行和顶栏重复的章节标题也去掉了。</li></ul>' +
      '<h3>1.8.1 修了什么</h3><ul>' +
      '<li><b>「双栏」现在一点就生效</b>：以前得先切到「翻页」再选双栏，在滚动模式下点双栏毫无反应（看着像坏了）。现在点「双栏」会自动切到翻页并排成两列，切回滚动则自动回到单栏，两个方向都会给一句提示。TXT 和 EPUB 一样。</li>' +
      '<li><b>切换阅读方式不丢位置</b>：滚动翻到一半再切翻页（或反过来），会停在你正看的那一段，不再跳回章首。</li>' +
      '<li><b>每页底部留白加宽</b>：翻页时最后一行不再紧贴底部工具栏。</li></ul>' +
      '<h3>1.7 新加了什么</h3><ul>' +
      '<li><b>全窗口中英双语</b>：书架顶栏一个开关，界面、设置、弹窗、提示与全部说明文档在中文 / 英文之间切换，选择会被记住。</li>' +
      '<li><b>划线高亮与批注</b>：选中正文四色高亮、随手写笔记；「笔记」页按章节汇总，可跳转、改色、编辑、删除。</li>' +
      '<li><b>导出与分享</b>：笔记一键导出 Markdown；划线可生成带书名与署名的分享图（PNG），也能只复制文字。</li>' +
      '<li><b>阅读总结</b>：本书累计时长、进度、批注数、书签数与逐章摘录一页看完，可复制或导出成笔记。</li>' +
      '<li><b>真正的书架</b>：自建书架、收藏、批量移动 / 移除、改书名作者、整目录导入。</li>' +
      '<li><b>阅读计时</b>：每次阅读自动记时长，按书与总计累计，全部留在本机。</li></ul>' +
      '<p class="kv">1.6 起还包含：174 个离线声线全放开、分角色朗读、朗读条直接换声线、书架续听、进程内语音引擎、完整 MIT 许可与署名。</p>' +
      '<h3>1.7.1 修了什么</h3><ul>' +
      '<li><b>桌面版终于能划线了</b>：桌面外壳默认把网页的文字选择关掉了，导致选中正文没反应、浮动色块也不出来。已放开，Windows 版的划线与批注和其他版本一样。</li>' +
      '<li><b>导入文件夹不再像在上传</b>：桌面版改用系统的「选择文件夹」对话框，不再是浏览器那个「选择要上传的文件夹 … 上传」的选择器。</li>' +
      '<li><b>左侧导航能退出了</b>：标签栏右侧加了 ×，再点同一个按钮也能收起，点正文空白处自动收起（有选区时不收，免得把手选的位置抖掉）。</li></ul>' +
      '<p class="kv">版本 ' + VER + ' · 单文件 · 默认零联网 · 数据仅存本机<br>作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）<br>问题反馈与源码：随发行包附带的 README 里有仓库地址</p>']
  };
  function showDoc(k) {
    var d = DOCS[k] || DOCS.help;
    var body = (CFG.lang === 'en' && window.MYDOCS_EN && window.MYDOCS_EN[k]) || d[1];
    /* 文档里写死「精选 21 个」这种数字，改一次表就得跟着改三处，容易漏。
       现在统一写 {cur} / {total}，开文档时按当前引擎报的数填进去。 */
    var _st = voiceStat();
    body = body.replace(/\{cur\}/g, _st.curated).replace(/\{total\}/g, _st.total);
    // 关于页最上面挂一张「当前包能力」卡片：装的是哪个包、离线语音有没有、系统朗读有几个引擎
    if (k === 'about') body = packCard() + body;
    var nav = '<div class="docnav">' + Object.keys(DOCS).map(function (x) {
      return '<button data-doc="' + x + '"' + (x === k ? ' class="on"' : '') + '>' + esc(T(DOCS[x][0])) + '</button>';
    }).join('') + '</div>';
    showModal(T(d[0]), nav + body, [{ label: T('关闭') }]);
  }
  function showSettings() {
    localProbe();
    var seg = function (key, opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="' + key + '" data-v="' + x[0] + '"' +
          (String(CFG[key]) === String(x[0]) ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var boolSeg = function (opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="bool" data-v="' + x[0] + '"' + (CFG[x[0]] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var encOpts = [['auto', T('自动识别')], ['utf-8', 'UTF-8'], ['gb18030', 'GB18030 / GBK'], ['big5', T('Big5 繁体')], ['utf-16le', 'UTF-16LE']];
    var cbg = hex6(CFG.customBg, hex6(curVar('--paper'), '#1F2125'));
    var ctx = hex6(CFG.customTx, hex6(curVar('--paperTx'), '#E6E4E1'));
    var h = '<h3>' + T('界面语言') + '</h3><div class="row"><label>' + T('界面语言') + '</label><div class="seg">' +
      [['zh', '中文'], ['en', 'English']].map(function (x) {
        return '<button data-lang="' + x[0] + '"' + (CFG.lang === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div><span class="kv">v' + VER + '</span>' +
      '<button data-act="chkUpd">' + T('检查更新') + '</button></div>' +
      '<div class="row"><label>' + T('启动时自动查新') + '</label>' + boolSeg([['updChk', T('启动时自动查新')]]) +
      '<span class="kv">' + T('默认关。本软件平时不联网；就算打开，也只是启动后读一次 90 KB 的版本清单，不传任何本机信息。') + '</span></div>' +
      '<h3>' + T('外观与版式') + '</h3>' +
      '<div class="row"><label>' + T('字号') + '</label><div class="seg">' +
        '<button data-act="fsDown">A−</button><button data-act="fsUp">A+</button></div>' +
        '<input type="range" data-set="fs" min="13" max="40" step="1" value="' + CFG.fs + '">' +
        '<span id="cfgFs">' + CFG.fs + 'px</span></div>' +
      '<div class="row"><label>' + T('行距') + '</label><input type="range" data-set="lh" min="1.2" max="2.6" step="0.05" value="' + CFG.lh + '">' +
        '<span id="cfgLh">' + Number(CFG.lh).toFixed(2) + '</span></div>' +
      '<div class="row"><label>' + T('字体') + '</label>' + fontGrid() + '</div>' +
      '<div class="row"><label>' + T('字重') + '</label>' + seg('fw', [
        [300, T('细')], [400, T('常规')], [600, T('中粗')], [700, T('粗')]]) + '</div>' +
      '<div class="row"><label>' + T('繁简') + '</label>' + seg('hans', [[0, T('原文')], [1, T('简体')]]) +
        '<span class="kv">' + T('看台版书、古籍时开「简体」；只改显示，书里的原文一个字都不动') + '</span></div>' +
      '<div class="row clrRow"><label>' + T('字色') + '</label>' + swRow('tx') +
        '<input type="color" data-set="customTx" value="' + ctx + '"><span class="kv">' + T('自定义') + '</span></div>' +
      '<div class="row clrRow"><label>' + T('底色') + '</label>' + swRow('bg') +
        '<input type="color" data-set="customBg" value="' + cbg + '">' +
        '<button data-act="clrColor">' + T('跟随主题') + '</button></div>' +
      '<div class="row"><label>' + T('主题') + '</label>' + seg('theme', THEMES.map(function (k) { return [k, T(THEME_NAME[k])]; })) + '</div>' +
      '<div class="row"><label>' + T('更多排版') + '</label><button data-act="type">' + T('打开排版面板') + '</button>' +
      '<span class="kv">' + T('段距 / 字距 / 首行缩进 / 分栏 / 翻页 / 版心 / 亮度 / 自动阅读') + '</span></div>' +
      '<h3>' + T('自动阅读') + '</h3>' +
      '<div class="row"><label>' + T('翻页停留') + '</label>' +
        '<input type="range" data-set="autoPageSec" min="3" max="180" step="1" value="' + Number(CFG.autoPageSec) + '">' +
        '<span id="cfgAp">' + Math.round(Number(CFG.autoPageSec)) + ' ' + T('秒/页') + '</span></div>' +
      '<div class="row"><label>' + T('滚动速度') + '</label>' +
        '<input type="range" data-set="autoScrollSpeed" min="1" max="10" step="1" value="' + Number(CFG.autoScrollSpeed) + '">' +
        '<span id="cfgAs">' + Number(CFG.autoScrollSpeed) + '</span>' +
        '<button data-act="autoNow">' + (AUTO.on ? T('停止自动阅读') : T('现在开始')) + '</button></div>' +
      '<p class="kv">' + T('翻页模式下按「停留秒数」自动翻页（3–180 秒）；滚动模式下按「滚动速度」匀速下滚。读到章末会自动接下一章。') + '</p>' +
      '<h3>' + T('朗读') + '</h3>' +
      '<div class="row"><label>' + T('默认语速') + '</label><input type="range" data-set="rate" min="0.5" max="2" step="0.1" value="' + CFG.rate + '"><span id="cfgRate">' + Number(CFG.rate).toFixed(1) + '×</span></div>' +
      '<div class="row"><label>' + T('句间停顿') + '</label><input type="range" data-set="pause" min="0" max="600" step="20" value="' + CFG.pause + '"><span id="cfgPause">' + CFG.pause + 'ms</span></div>' +
      '<div class="row"><label>' + T('选项') + '</label>' + boolSeg([
        ['autoNext', T('念完自动下一章')], ['follow', T('高亮跟随滚动')], ['whole', T('整句朗读（更自然）')],
        ['voiceAuto', T('优先自然语音')], ['motion', T('减少动效')]]) + '</div>' +
      '<div class="row"><label>' + T('英文语音') + '</label>' + boolSeg([['enVoice', T('英文语音')]]) +
        '<span class="kv">' + T('中文书里夹的英文词、整段英文由它念。安卓上这套模型在个别设备会卡住——如果开着发现朗读停住不动，把它关掉，中文立刻恢复。') + '</span></div>' +
      '<div class="row"><label>' + T('语音') + '</label><button data-doc="voice">' + T('语音与朗读说明') + '</button><span class="kv">' + T('当前：') +
      esc(voiceLabel(curVoice() || { name: T('系统默认'), lang: 'zh-CN', localService: true })) + '</span></div>' +
      '<h3>' + T('免费神经语音 · 离线开源') + '</h3>' +
      '<p class="kv">' + T('本机跑 sherpa-onnx + 开源中文神经语音模型（默认 22 kHz 女主与男主，另带 187 个配角说话人）：接近真人的中文语调，不收费、不联网、不用账号、不用 Key。语音库已随成品装好，听书前双击「VoicePack/启动语音引擎.cmd」即可。') + '</p>' +
      '<div class="row"><label>' + T('引擎状态') + '</label><div class="seg">' +
      '<span class="kv" style="align-self:center">' + (localReady() ? T('● 已连接（免费神经语音）') : T('○ 未检测到（当前用系统语音）')) + '</span>' +
      '<button data-act="probe">' + T('重新检测') + '</button>' +
      '<button data-set="bool" data-v="localOn"' + (CFG.localOn ? ' class="on"' : '') + '>' + (CFG.localOn ? T('自动连接：开') : T('自动连接：关')) + '</button>' +
      '<button data-doc="local">' + T('安装与使用说明') + '</button></div></div>' +
      '<div class="row"><label>' + T('音色') + '</label><select data-set="localVoice">' + localVoiceOptions(true) +
      '</select><button data-act="tryvoice">' + T('试听音色') + '</button></div>' +
      /* 旁白男女声：两条各自记住，换书一键换。文学/情感用女声，武侠/历史用男声，
         不必每次都在这一百多个声线里重新翻一遍。 */
      '<div class="row"><label>' + T('旁白男 / 女声') + '</label><div class="seg">' +
      ['f', 'm'].map(function (g) {
        var k = g === 'm' ? CFG.narrM : CFG.narrF;
        var on = voiceGender(CFG.localVoice) === (g === 'm' ? 'm' : 'f');
        return '<button data-act="narr' + g.toUpperCase() + '"' + (on ? ' class="on"' : '') + '>' +
          (g === 'm' ? T('男声') : T('女声')) + '：' + esc(k ? T(localVoiceName(k)) : T('未选')) + '</button>';
      }).join('') + '</div>' +
      '<span class="kv">' + T('按书换：温情文学可用女声，武侠历史可用男声。点一下整本旁白都换过去，阅读进度不受影响；男女两条各自记住上次选的声线。') + '</span></div>' +
      '<div class="row"><label>' + T('男主声线') + '</label><select data-set="leadM">' + leadSelOptions('m') + '</select>' +
      '<span class="kv">' + T('分角色朗读时，书里男角色里的主角用这一条') + '</span></div>' +
      '<div class="row"><label>' + T('女主声线') + '</label><select data-set="leadF">' + leadSelOptions('f') + '</select>' +
      '<span class="kv">' + T('分角色朗读时，书里女角色里的主角用这一条') + '</span></div>' +
      '<div class="row"><label>' + T('我的主角声线') + '</label><div class="seg" id="pinBox">' + pinChips() + '</div></div>' +
      '<p class="kv">' + T('这一栏就是「主角声线」：点哪个名字，朗读立刻换成那个声音，同时它进朗读条最左边的下拉——所以「置顶」和「设为主角」是同一件事，不用分两步做。点 × 只是把它从朗读条里拿掉，不会取消正在用的声音，声线本身也没丢。') + '</p>' +
      '<p class="kv">' + T('只有「原版」男女主是固定的——删了就没默认声音兜底。其余全部自由：六个音高变体、187 个配角声线、你自己挑的，都能删能加，最多 {max} 个（女声、男声各 {half}）。点 × 只从朗读条移除，声线本身没丢，随时在下面加回来。', { max: PIN_MAX, half: PIN_PER_GENDER }) + '</p>' +
      '<p class="kv">' + T('这套中性音色不合耳朵很正常——187 个人声，总有一个让你心动的声音。合耳的留下，不合耳的删掉，把选择权留给你自己。') + '</p>' +
      '<div class="row"><label>' + T('男声降噪') + '</label>' + seg('dnMode', [
        [0, T('原声')], [1, T('更干净')], [2, T('更清楚')]
      ]) + '</div>' +
      '<p class="kv">' + T('只作用于男声，女声一个采样都不碰。手机喇叭外放多半用不着调——实测手机外放听男声是清楚的，那点「沙沙」要接功放或高解析耳机才明显，而压过之后字会变闷，损失比收益大。所以默认「原声」：觉得干净就别动它；接音箱、耳机听着沙沙的，再往上调一档。「更干净」压得最彻底，代价是个别字略糊、整体偏闷；「更清楚」保字头，字更实但压得稍轻。切换会从当前这句用新档位重念，方便直接对比。') + '</p>' +
      '<div class="row"><label>' + T('声线范围') + '</label>' + seg('voiceSet', [['curated', T('精选 {n} 个', { n: voiceStat().curated })], ['all', T('全部 {n} 个', { n: voiceStat().total })]]) + '</div>' +
      '<p class="kv">' + T('模型里另有 {n} 个中文说话人（{f} 女 + {m} 男），共用同一份压缩模型，放开多少个都不增加体积。「全部」按音高分 7 档列出，男低 → 女高任你挑；「精选」是人工挑过、命名过的 {c} 个，不想挑就用它。上面选中的声线会进「我的主角声线」（点一下就是设为主角），也就能在朗读条最左边下拉里直接换，正在朗读时会从当前这段用新音色重念。缺模型文件的音色会自动隐藏。',
        { n: voiceStat().lib, f: voiceStat().female, m: voiceStat().male, c: voiceStat().curated }) + '</p>' +
      '<div class="row"><label>' + T('分角色朗读') + '</label><div class="seg">' +
      '<button data-set="bool" data-v="roleOn"' + (CFG.roleOn ? ' class="on"' : '') + '>' + (CFG.roleOn ? T('分角色：开') : T('分角色：关')) + '</button>' +
      [['mix', T('男女混合')], ['female', T('全女声')], ['male', T('全男声')]].map(function (x) {
        return '<button data-set="rolePool" data-v="' + x[0] + '"' + (CFG.rolePool === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '<button data-set="bool" data-v="roleWide"' + (CFG.roleWide ? ' class="on"' : '') + '>' +
        (CFG.roleWide ? T('角色用全库声线：开') : T('角色用全库声线：关')) + '</button>' +
        '<button data-act="tryrole">' + T('试听效果') + '</button></div></div>' +
      '<div class="row"><label>' + T('这本书的角色') + '</label><div class="seg">' +
        '<span class="kv" id="castStat" style="align-self:center">' + esc(castStatTx()) + '</span>' +
        '<button data-act="scanCast">' + T('识别一遍') + '</button></div></div>' +
      '<p class="kv">' + (localReady()
        ? T('已连接神经语音，分角色默认开启：旁白用你选的声线，引号里的对白按人物自动换声——「我说」「他说」「张三说」都是不同的声音，同一个人物整本书都是同一个声音。') +
          T('这本书已认出 {n} 个人物，用掉 {m} 个声线。默认从精选里配，「角色用全库声线」打开后才会动用全部 {all} 个——全库那套更慢，人多的书会明显等，所以默认关着。',
            { n: Object.keys(SPK.cast || {}).length, m: Object.keys(SPK.used || {}).length, all: voiceStat().total })
        : T('⚠ 还没连上神经语音引擎：分角色现在不生效（系统语音只能发出一个声音）。完整版首次启动会自动准备；Lite 版双击「VoicePack/启动语音引擎.cmd」，再回这里点「重新检测」。')) + '</p>' +
      '<div class="row"><label>' + T('端口') + '</label><input type="number" data-set="localPort" min="1024" max="65535" step="1" value="' + (Number(CFG.localPort) || 8177) + '" style="width:96px"><span class="kv">' + T('默认 8177，需与启动器一致') + '</span></div>' +
      '<p class="kv">' + T('朗读文字只发给本机的 127.0.0.1 合成，不产生对外网络请求；引擎没启动时自动用系统语音，不影响看书。') + '</p>' +
      '<h3>' + T('网盘同步 · WebDAV') + ' <span class="kv" style="font-weight:400">' + T('（实验性）') + '</span></h3>' +
      (!wdReady()
        ? '<p class="kv">' + T('网页版用不了网盘同步：浏览器里的网页存不进网盘（网盘几乎都不允许跨域读写），要用桌面版或手机版。') + '</p>'
        : '<div class="row"><label>' + T('自动同步') + '</label><div class="seg">' +
            '<button data-act="wdOn"' + (WD.on ? ' class="on"' : '') + '>' + (WD.on ? T('自动同步：开') : T('自动同步：关')) + '</button>' +
            '<button data-act="wdTest">' + T('测试连接') + '</button>' +
            '<button data-act="wdNow">' + T('立即同步') + '</button></div></div>' +
          '<div class="row"><label>' + T('服务器') + '</label>' +
            '<input type="text" data-wd="url" spellcheck="false" placeholder="https://dav.jianguoyun.com/dav/" value="' + esc(WD.url) + '"></div>' +
          '<div class="row"><label>' + T('账号') + '</label>' +
            '<input type="text" data-wd="user" spellcheck="false" autocomplete="off" value="' + esc(WD.user) + '"></div>' +
          '<div class="row"><label>' + T('应用密码') + '</label>' +
            '<input type="password" data-wd="pass" autocomplete="new-password" value="' + esc(WD.pass) + '"></div>' +
          '<div class="row"><label>' + T('远端目录') + '</label>' +
            '<input type="text" data-wd="dir" spellcheck="false" placeholder="' + esc(T('留空 = 网盘根目录')) + '" value="' + esc(WD.dir) + '">' +
            '<span class="kv">' + T('同步文件是 moyin-meta.json') + '</span></div>' +
          '<div class="row"><label>' + T('状态') + '</label><span class="kv">' +
            esc((WD.msg || T('还没同步过')) + (WD.at ? ' · ' + fmtDate(WD.at) : '')) + '</span></div>' +
          '<p class="kv">' + esc(wdTip()) + '</p>') +
      '<h3>' + T('文件与界面') + '</h3><div class="row"><label>' + T('TXT 编码') + '</label><select data-set="txtEnc">' +
      encOpts.map(function (x) { return '<option value="' + x[0] + '"' + (CFG.txtEnc === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
      '</select><span class="kv">' + T('改完重新打开书生效') + '</span></div>' +
      '<div class="row"><label>' + T('分栏') + '</label>' + seg('lay', [['auto', T('自动')], ['one', '1'], ['two', '2']]) +
      '<span class="kv">' + T('自动按屏宽定；也可手动单栏 / 双栏（手机始终单栏）') + '</span></div>' +
      '<div class="row"><label>' + T('阅读模式') + '</label>' + seg('mode', [['scroll', T('滚动')], ['page', T('翻页')]]) + '</div>' +
      '<p class="kv">' + T('设置即时生效并保存在本机。') + '</p>';
    showModal(T('阅读设置'), h, [{ label: T('恢复默认'), fn: function () { Object.assign(CFG, DEF); saveCfg(); applyCfg(); fillVoices(); showSettings(); toast(T('已恢复默认')); } }, { label: T('完成'), cls: 'pri' }]);
    $('modalBody').oninput = function (e) {
      /* WebDAV 的四个输入框不进 CFG（密码尤其不能进），单独存 MOYIN_WD */
      var wk = e.target.getAttribute('data-wd');
      if (wk) { WD[wk] = e.target.value; wdSave(); return; }
      var k = e.target.getAttribute('data-set'); if (!k) return;
      CFG[k] = (k === 'fs' || k === 'pagew' || k === 'pause' || k === 'localPort' ||
        k === 'autoPageSec' || k === 'autoScrollSpeed' || k === 'restMin') ? parseInt(e.target.value, 10)
        : (k === 'lh' || k === 'rate') ? parseFloat(e.target.value) : e.target.value;
      var lab = { fs: 'cfgFs', lh: 'cfgLh', pagew: 'cfgPw', rate: 'cfgRate', pause: 'cfgPause',
        autoPageSec: 'cfgAp', autoScrollSpeed: 'cfgAs' }[k];
      if (lab) $(lab).textContent = (k === 'lh' ? Number(e.target.value).toFixed(2) : e.target.value) +
        ({ fs: 'px', pagew: 'px', rate: '×', pause: 'ms', autoPageSec: ' ' + T('秒/页') }[k] || '');
      saveCfg(); applyCfg();
      if (k === 'autoPageSec') autoRetime();
    };
    $('modalBody').onchange = function (e) {
      var k = e.target.getAttribute('data-set');
      if (k === 'txtEnc') { CFG.txtEnc = e.target.value; saveCfg(); toast(T('TXT 编码已设为 ') + e.target.value + T('，重新打开书生效')); }
      else if (k === 'localVoice') {
        // 选中即切过去，并自动进朗读条置顶（主角固定那套不占位）
        pickLocalVoice(e.target.value);
      }
      else if (k === 'leadM' || k === 'leadF') {
        /* 主角换声线要重排角色表，不能只写配置——所以走 setLead 而不是通用逻辑 */
        setLead(k === 'leadM' ? 'm' : 'f', e.target.value);
      }
    };
    $('modalBody').onclick = function (e) {
      var lang = e.target.closest('[data-lang]');
      if (lang) { setLang(lang.getAttribute('data-lang')); showSettings(); return; }
      /* 色板圆点是裸 button（没有 data-set），要放在下面那个早退判断之前 */
      var swT0 = e.target.closest('[data-tx]');
      if (swT0) { CFG.customTx = swT0.getAttribute('data-tx'); saveCfg(); applyCfg(); showSettings(); return; }
      var swB0 = e.target.closest('[data-bg]');
      if (swB0) {
        var bg0 = swB0.getAttribute('data-bg');
        var ink0 = inkFor(bg0);
        CFG.customBg = bg0;
        if (ink0) { CFG.customTx = ink0; toast(T('底色较深，字色已自动调成浅色')); }
        saveCfg(); applyCfg(); showSettings(); return;
      }
      var b = e.target.closest('button[data-set],button[data-act],button[data-pin]'); if (!b) return;
      /* 「我的主角声线」里的芯片：× 是移除置顶，点名字是切过去（也就是设为主角） */
      if (b.hasAttribute('data-pin')) {
        var unp = e.target.closest('[data-unpin]');
        if (unp) { unpinVoice(unp.getAttribute('data-unpin')); return; }
        var pk = b.getAttribute('data-pin');
        pickLocalVoice(pk);           // 主角那几个没有 ×，点了只切过去，不会动置顶
        return;
      }
      var act = b.getAttribute('data-act');
      if (act === 'type') { showType(); return; }
      if (act === 'fsDown' || act === 'fsUp') {
        CFG.fs = Math.max(13, Math.min(40, (Number(CFG.fs) || 19) + (act === 'fsUp' ? 1 : -1)));
        saveCfg(); applyCfg(); showSettings(); return;
      }
      if (act === 'autoNow') {
        if (!BK) { toast(T('先打开一本书')); return; }
        if (AUTO.on) autoStop(); else { closeModal(); autoStart(); }
        if (BK) showSettings();
        return;
      }
      if (act === 'clrColor') {
        CFG.customBg = ''; CFG.customTx = ''; saveCfg(); applyCfg(); showSettings();
        toast(T('已跟随主题配色')); return;
      }
      if (act === 'tryvoice') { tryVoice(); return; }
      if (act === 'narrF' || act === 'narrM') {
        setNarr(act === 'narrM' ? 'm' : 'f'); showSettings(); return;
      }
      if (act === 'tryrole') { tryRole(); return; }
      if (act === 'scanCast') {
        if (!BK) { toast(T('先打开一本书')); return; }
        if (!localReady()) { toast(T('分角色要用本机神经语音：完整版首次启动会自动准备'), 4600); return; }
        if (!CFG.roleOn) { CFG.roleOn = 1; saveCfg(); }
        SPK.castAt = '';
        var cn0 = buildCast(BK.ch | 0);
        showSettings();
        toast(cn0 ? T('认出 {n} 个角色，各自配好了声线', { n: cn0 })
                   : T('这一章里没认出人物，往后读几章再试一次'), 3200);
        return;
      }
      if (act === 'probe') { LOCAL.miss = 0; localProbe(true).then(function () { showSettings(); }); return; }
      if (act === 'wdOn') {
        WD.on = WD.on ? 0 : 1; wdSave(); showSettings();
        if (WD.on && !WD.url) toast(T('记得把服务器、账号、应用密码填上，再点「测试连接」'), 3600);
        return;
      }
      if (act === 'wdTest') { wdTest(); return; }
      if (act === 'wdNow') { wdSync(true); return; }
      if (act === 'chkUpd') { checkUpdate(true); return; }
      var k = b.getAttribute('data-set'), v = b.getAttribute('data-v');
      if (k === 'bool') CFG[v] = CFG[v] ? 0 : 1;
      else if (k === 'dnMode') CFG[k] = Number(v) || 0;   // 降噪档位存数字，别留成字符串
      else CFG[k] = v;
      /* 多栏与翻页联动，两个入口（设置 / 排版面板）行为保持一致 */
      if (k === 'lay' && (LAYN[v] || 0) > 1) CFG.mode = 'page';
      if (k === 'mode' && v === 'scroll' && (LAYN[CFG.lay] || 0) > 1) CFG.lay = 'auto';
      if (k === 'mode') { PG.ready = 0; CFG.modeTouched = 1; }   // 自己选的阅读方式，以后不再跟着默认值改
      saveCfg(); applyCfg();
      if (v === 'voiceAuto' && CFG.voiceAuto) fillVoices();
      if (v === 'localOn') { LOCAL.ready = false; if (CFG.localOn) localProbe(); voiceBadge(curVoice()); }
      if (v === 'voiceSet') fillVoices();
      if (v === 'roleOn') CFG.roleTouched = 1;
      if (v === 'voiceSet' || v === 'roleOn' || k === 'rolePool') { if (SPK.playing) speakJump(0); }
      // 换降噪档位后立刻用新档位重念当前这段，否则要等下一句才听得到差别
      if (k === 'dnMode') { if (SPK.playing) speakJump(0); else toast(T('降噪已切到「{v}」，点朗读听听效果', { v: T(DN_NAME[CFG.dnMode]) }), 3000); }
      if (k === 'hans') renderKeep();          // 繁简是显示层的事，重绘当前章即可
      showSettings();
    };
  }
  /* ---------------- 排版面板（1.8） ---------------- */
  var TYPE_KEYS = ['theme', 'mode', 'lay', 'pageAnim', 'fs', 'lh', 'fw', 'hans', 'ps', 'ls', 'indent', 'padw', 'pagew', 'ff', 'align', 'dim', 'customBg', 'customTx', 'autoScrollSpeed', 'autoPageSec', 'showClock', 'restMin'];
  var TYPE_NUM = { fs: 'int', pagew: 'int', padw: 'int', autoScrollSpeed: 'int', autoPageSec: 'int', hans: 'int', lh: 'float', ps: 'float', ls: 'float', dim: 'float' };
  var TH_SW = { dark: '#1F2125', light: '#FFFFFF', sepia: '#FAF3E3', green: '#F3F8EC', gray: '#252D37', black: '#000000' };
  function hex6(v, alt) { v = String(v || '').trim(); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : alt; }
  /* 相对亮度：选深色底时自动配浅色字，免得挑完看不清 */
  function lumOf(hex) {
    var h = hex6(hex, '#808080');
    var c = [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; })
      .map(function (v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  var INK_LIGHT = '#E8E6E2', INK_DARK = '#26262A';
  /* 底与字反差不够时给出该换的字色；够就返回空 */
  function inkFor(bg) {
    var lb = lumOf(bg), lt = lumOf(CFG.customTx || curVar('--paperTx') || INK_DARK);
    if (Math.abs(lb - lt) >= 0.35) return '';
    return lb < 0.4 ? INK_LIGHT : INK_DARK;
  }
  /* 字体按钮：每个按钮用它自己的字体渲染，挑之前就能看出区别 */
  function fontGrid() {
    return '<div class="ffGrid">' + FONT_LIST.map(function (x) {
      var fam = String(FONTS[x[0]] || '').replace(/"/g, "'");
      return '<button data-set="ff" data-v="' + x[0] + '"' + (CFG.ff === x[0] ? ' class="on"' : '') +
        " style=\"font-family:" + fam + '\">' + esc(T(x[1])) + '</button>';
    }).join('') + '</div>';
  }
  /* 常用色板：kind = 'tx' 字色 / 'bg' 底色 */
  function swRow(kind) {
    var list = kind === 'tx' ? TX_SW : BG_SW;
    var cur = String((kind === 'tx' ? CFG.customTx : CFG.customBg) || '').toLowerCase();
    return '<div class="swRow">' + list.map(function (x) {
      return '<button class="swDot' + (cur === x[0].toLowerCase() ? ' on' : '') + '" data-' + kind + '="' + x[0] + '"' +
        ' title="' + esc(T(x[1])) + '" style="background:' + x[0] + '"></button>';
    }).join('') + '</div>';
  }
  function curVar(n) { return (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim(); }
  function typeLabels() {
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('fFs', Number(CFG.fs) + 'px');
    set('fLh', Number(CFG.lh).toFixed(2));
    set('fPs', Number(CFG.ps).toFixed(2) + 'em');
    set('fLs', Number(CFG.ls).toFixed(2) + 'em');
    set('fPw', Number(CFG.pagew) + 'px');
    set('fPd', Number(CFG.padw) + 'px');
    set('fDim', Math.round(Number(CFG.dim) * 100) + '%');
    set('fAs', String(Number(CFG.autoScrollSpeed)));
    set('fAp', T('{n} 秒/页', { n: Math.round(Number(CFG.autoPageSec)) }));
    set('fAsHint', T('约 {n} 秒一屏', { n: Math.round((($('pageWrap') || {}).clientHeight || 600) / autoSpeedPx()) }));
  }
  function showType(keep) {
    var st = keep && $('modalBody') ? $('modalBody').scrollTop : 0;
    var seg = function (key, opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="' + key + '" data-v="' + x[0] + '"' +
          (String(CFG[key]) === String(x[0]) ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var cell = function (lb, inner) { return '<div class="cell"><span class="lb">' + T(lb) + '</span>' + inner + '</div>'; };
    var rng = function (key, min, max, step, style) {
      return '<input type="range" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step +
        '" value="' + CFG[key] + '"' + (style ? ' style="' + style + '"' : '') + '>';
    };
    var th = '<div class="sw-grid">' + THEMES.map(function (k) {
      return '<button class="th' + (CFG.theme === k ? ' on' : '') + '" data-th="' + k + '">' +
        '<span class="sw" style="background:' + TH_SW[k] + '"></span>' + esc(T(THEME_NAME[k])) + '</button>';
    }).join('') + '</div>';
    var cbg = hex6(CFG.customBg, hex6(curVar('--paper'), '#1F2125'));
    var ctx = hex6(CFG.customTx, hex6(curVar('--paperTx'), '#E6E4E1'));
    var h = '';
    h += '<h3>' + T('阅读方式') + '</h3><div class="tpGrid">' +
      cell('模式', seg('mode', [['scroll', T('滚动')], ['page', T('翻页')]])) +
      cell('分栏', seg('lay', [['auto', T('自动')], ['one', '1'], ['two', '2']])) +
      cell('翻页动画', seg('pageAnim', [['slide', T('滑动')], ['fade', T('淡入')], ['none', T('无')]])) +
      '</div><p class="kv">' + T('「翻页」是一页一页左右翻。双栏靠翻页成立：自动按屏宽定，也可手动选单栏 / 双栏（手机始终单栏）；点双栏会自动切到翻页。') + '</p>';
    h += '<h3>' + T('文字') + '</h3>' +
      '<div class="row"><label>' + T('字号') + '</label><button data-font="fs-">A−</button><span id="fFs">' + CFG.fs + 'px</span><button data-font="fs+">A＋</button>' +
      rng('fs', 13, 34, 1, 'flex:1;min-width:110px') + '</div>' +
      '<div class="row"><label>' + T('行距') + '</label>' + rng('lh', 1.2, 2.6, 0.05, 'flex:1') + '<span id="fLh">' + CFG.lh + '</span></div>' +
      '<div class="row"><label>' + T('段间距') + '</label>' + rng('ps', 0, 2, 0.05, 'flex:1') + '<span id="fPs">' + CFG.ps + '</span></div>' +
      '<div class="row"><label>' + T('字间距') + '</label>' + rng('ls', -0.02, 0.16, 0.01, 'flex:1') + '<span id="fLs">' + CFG.ls + '</span></div>' +
      '<div class="row"><label>' + T('首行缩进') + '</label>' + seg('indent', [[0, T('无缩进')], [2, T('缩进 2 字')]]) + '</div>' +
      '<div class="row"><label>' + T('字体') + '</label>' + fontGrid() + '</div>' +
      '<div class="row"><label>' + T('字重') + '</label>' + seg('fw', [
        [300, T('细')], [400, T('常规')], [600, T('中粗')], [700, T('粗')]]) + '</div>' +
      '<div class="row"><label>' + T('繁简') + '</label>' + seg('hans', [[0, T('原文')], [1, T('简体')]]) + '</div>' +
      '<div class="row"><label>' + T('对齐') + '</label>' + seg('align', [['justify', T('两端')], ['left', T('左对齐')]]) + '</div>';
    h += '<h3>' + T('版心') + '</h3>' +
      '<div class="row"><label>' + T('页宽') + '</label>' + rng('pagew', 380, 1100, 20, 'flex:1') + '<span id="fPw">' + CFG.pagew + 'px</span></div>' +
      '<div class="row"><label>' + T('页边距') + '</label>' + rng('padw', 10, 96, 2, 'flex:1') + '<span id="fPd">' + CFG.padw + 'px</span></div>';
    h += '<h3>' + T('配色') + '</h3>' + th +
      '<div class="row clrRow"><label>' + T('自定义颜色') + '</label>' +
      '<span class="kv">' + T('底色') + '</span><input type="color" data-set="customBg" value="' + cbg + '">' +
      '<span class="kv">' + T('字色') + '</span><input type="color" data-set="customTx" value="' + ctx + '">' +
      '<button data-act="clr">' + T('清空') + '</button><span class="kv">' + T('清空后跟随主题') + '</span></div>' +
      '<div class="row"><label>' + T('亮度') + '</label>' + rng('dim', 0, 0.55, 0.05, 'flex:1') + '<span id="fDim">0%</span></div>';
    h += '<h3>' + T('自动阅读') + '</h3>' +
      '<div class="row"><label>' + T('滚动速度') + '</label>' + rng('autoScrollSpeed', 1, 10, 1, 'flex:1') + '<span id="fAs">3</span><span class="kv" id="fAsHint"></span></div>' +
      '<div class="row"><label>' + T('翻页停留') + '</label>' + rng('autoPageSec', 3, 180, 1, 'flex:1') + '<span id="fAp">20s</span></div>' +
      '<div class="row"><label>' + T('开始 / 停止') + '</label><button data-act="auto">' + T('自动阅读：开 / 关') + '</button>' +
      '<span class="kv">' + T('空格也能暂停 / 继续；翻页模式下用停留秒数，滚动模式下用滚动速度') + '</span></div>';
    h += '<h3>' + T('阅读时钟') + '</h3>' +
      '<div class="row"><label>' + T('顶栏时钟') + '</label>' + seg('showClock', [[1, T('显示')], [0, T('隐藏')]]) +
      '<span class="kv">' + T('显示当前时间与本次已读时长，点顶栏那个时间块也能改') + '</span></div>' +
      '<div class="row"><label>' + T('休息提醒') + '</label>' + seg('restMin',
        [[0, T('关闭')], [30, '30'], [45, '45'], [60, '60'], [90, '90']]) +
      '<span class="kv">' + T('连续读到设定时长提醒休息，可稍后再提') + '</span></div>';
    h += '<h3>' + T('快捷键') + '</h3><p class="kv kbdline">' +
      '<span class="kbd">←</span> <span class="kbd">→</span> ' + T('翻页 / 翻屏') + ' · ' +
      '<span class="kbd">空格</span> ' + T('下一屏（朗读中为暂停）') + ' · ' +
      '<span class="kbd">F11</span> ' + T('全屏') + ' · ' +
      '<span class="kbd">Esc</span> ' + T('退出全屏 / 关闭侧栏') + ' · ' +
      '<span class="kbd">T</span> ' + T('换主题') + ' · ' +
      '<span class="kbd">A</span> ' + T('自动阅读') + ' · ' +
      '<span class="kbd">Ctrl</span>+<span class="kbd">+</span>/<span class="kbd">−</span> ' + T('字号') + '</p>';
    h += '<p class="kv">' + T('点选即时生效，自动保存。') + '</p>';
    showModal(T('排版与外观'), h, [
      { label: T('恢复默认'), fn: function () {
        TYPE_KEYS.forEach(function (k) { CFG[k] = DEF[k]; });
        saveCfg(); PG.ready = 0; applyCfg(); showType(true); toast(T('排版已恢复默认'));
      } },
      { label: T('完成'), cls: 'pri' }]);
    var mb = $('modalBody');
    mb.oninput = function (e) {
      var el = e.target, k = el.getAttribute('data-set'); if (!k) return;
      var v = el.value;
      if (TYPE_NUM[k] === 'int') v = parseInt(v, 10) || 0;
      else if (TYPE_NUM[k] === 'float') v = parseFloat(v) || 0;
      CFG[k] = v; saveCfg(); applyCfg(); typeLabels();
      if (k === 'autoPageSec') autoRetime();
    };
    mb.onclick = function (e) {
      var thb = e.target.closest('[data-th]');
      if (thb) { setTheme(thb.getAttribute('data-th')); showType(true); return; }
      var f = e.target.closest('[data-font]');
      if (f) {
        var d = f.getAttribute('data-font') === 'fs+' ? 1 : -1;
        CFG.fs = Math.max(13, Math.min(34, Number(CFG.fs) + d));
        saveCfg(); applyCfg(); showType(true); return;
      }
      var swT2 = e.target.closest('[data-tx]');
      if (swT2) { CFG.customTx = swT2.getAttribute('data-tx'); saveCfg(); applyCfg(); showType(true); return; }
      var swB2 = e.target.closest('[data-bg]');
      if (swB2) {
        var bg2 = swB2.getAttribute('data-bg');
        var ink2 = inkFor(bg2);
        CFG.customBg = bg2;
        if (ink2) { CFG.customTx = ink2; toast(T('底色较深，字色已自动调成浅色')); }
        saveCfg(); applyCfg(); showType(true); return;
      }
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'clr') { CFG.customBg = ''; CFG.customTx = ''; saveCfg(); applyCfg(); showType(true); return; }
        if (a === 'auto') { closeModal(); autoToggle(); return; }
        return;
      }
      var b = e.target.closest('button[data-set]'); if (!b) return;
      var k2 = b.getAttribute('data-set'), v2 = b.getAttribute('data-v');
      var tip = '';
      if (k2 === 'mode') CFG.modeTouched = 1;   // 同上：手动选过就一直听你的
      if (k2 === 'lay' && (LAYN[v2] || 0) > 1 && CFG.mode !== 'page') {
        /* 多栏要配合翻页才有意义，点了就直接带过去，别让人以为没反应 */
        CFG.mode = 'page'; tip = T('多栏需配合翻页，已切到翻页模式');
      } else if (k2 === 'mode' && v2 === 'scroll' && (LAYN[CFG.lay] || 0) > 1) {
        CFG.lay = 'auto'; tip = T('滚动模式只有单栏，多栏请留在翻页');
      }
      CFG[k2] = v2;
      saveCfg(); applyCfg();
      if (k2 === 'hans') renderKeep();
      showType(true);
      if (tip) toast(tip, 2400);
    };
    if (st) mb.scrollTop = st;
    typeLabels();
  }

  /* ---------------- 备份 ---------------- */
  async function exportBak(withFiles) {
    var safeCfg = Object.assign({}, CFG); // 设置里没有任何密钥，可完整备份
    var books = await dbAll('books'), data = {
      app: 'MoYinReader', v: 1, exported: new Date().toISOString(),
      cfg: safeCfg, books: books, blobs: {}
    };
    if (withFiles) {
      var bl = await dbAll('blobs') || [];
      bl.forEach(function (r) { data.blobs[r.id] = b64(r.buf); });
    }
    var n = new Date(), d = n.getFullYear() + String(n.getMonth() + 1).padStart(2, '0') + String(n.getDate()).padStart(2, '0');
    download('MoYin-backup-' + d + '.json', JSON.stringify(data));
    toast(T('备份已导出') + (withFiles ? T('（含 {n} 本书文件）', { n: Object.keys(data.blobs).length }) : T('（仅进度与设置）')));
  }
  function askExport() {
    showModal(T('导出备份'), '<p>' + T('把进度、书签、设置导出成一个 JSON 文件。') + '</p>' +
      '<p><label><input type="checkbox" id="bakFull"> ' + T('同时包含书籍原文件（体积较大，可在新设备直接还原整架书）') + '</label></p>' +
      '<p class="kv">' + T('不勾选则只导出元数据，换设备后需要重新导入 TXT / EPUB 原文件。') + '</p>',
      [{ label: T('取消') }, { label: T('导出'), cls: 'pri', fn: function () { var f = $('bakFull') && $('bakFull').checked; closeModal(); exportBak(!!f); } }]);
  }
  async function importBak(file) {
    try {
      var d = JSON.parse(await file.text());
      if (d.app !== 'MoYinReader' || !Array.isArray(d.books)) throw new Error(T('不是墨吟的备份文件'));
      if (d.cfg) { Object.keys(DEF).forEach(function (k) { if (d.cfg[k] !== undefined) CFG[k] = d.cfg[k]; }); saveCfg(); applyCfg(); }
      var added = 0;
      for (var i = 0; i < d.books.length; i++) {
        var m = d.books[i];
        if (!m || !m.id) continue;
        await dbPut('books', m);
        var idx = BOOKS.findIndex(function (b) { return b.id === m.id; });
        if (idx >= 0) BOOKS[idx] = m; else BOOKS.push(m);
        added++;
      }
      var blobs = d.blobs || {}, keys = Object.keys(blobs);
      for (var j = 0; j < keys.length; j++) await dbPut('blobs', { id: keys[j], buf: unb64(blobs[keys[j]]) });
      renderShelf();
      toast(T('已还原 {n} 条记录', { n: added }) + (keys.length ? T('、{n} 本书文件', { n: keys.length }) : T('（未含书文件，请重新导入原书）')), 4200);
    } catch (e) { showModal(T('导入失败'), '<p>' + esc(e.message) + '</p>', [{ label: T('关闭') }]); }
  }

  /* ---------------- 网盘同步（WebDAV） ----------------
     只同步「读到哪儿、书签、批注、分组」，不搬书文件：两台机器上各自导入同一个文件时，
     内容指纹一样，进度自动套上，一个字节都不用传。传整本书是下一步的事。

     三条硬约束，改代码别看漏：
     ① WebDAV 服务几乎都不发 CORS 头，页面里直接 fetch 必被拦。所以请求全部交给本地壳
        发（桌面 Python / 安卓 Java），页面只跟 127.0.0.1 说话。网页版没有本地壳，不支持。
     ② 应用密码绝不能进 CFG：exportBak 是 Object.assign({}, CFG) 全量导出，密码进了 CFG
        就等于跟着备份文件走、还可能被传到别处。单独存 MOYIN_WD，导出时天然剔除。
     ③ 默认关闭。这软件摆第一位的承诺是「默认零联网」，不能因为加了同步就破例。 */
  var WDKEY = 'MOYIN_WD';
  var WD = { url: '', user: '', pass: '', dir: '', on: 0, at: 0, msg: '', dev: '' };
  var WDBUSY = 0, WDTIME = 0;
  function wdLoad() {
    try {
      var s = JSON.parse(localStorage.getItem(WDKEY) || '{}');
      Object.keys(WD).forEach(function (k) { if (s[k] !== undefined && s[k] !== null) WD[k] = s[k]; });
    } catch (e) { /* 隐私模式：这次会话填了就管用，关掉就没了 */ }
    if (!WD.dev) { WD.dev = 'd' + Math.random().toString(36).slice(2, 8); wdSave(); }
  }
  function wdSave() { try { localStorage.setItem(WDKEY, JSON.stringify(WD)); } catch (e) { } }
  /* 有没有本地壳能代发请求。没有就是网页版——UI 上直说，别让人填完密码才发现不行。 */
  function wdReady() { return typeof window.__moyinWebdav === 'function'; }
  function wdBase() {
    var u = String(WD.url || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    if (u.slice(-1) !== '/') u += '/';
    var d = String(WD.dir || '').replace(/^\/+|\/+$/g, '');
    return u + (d ? d + '/' : '');
  }
  function wdMetaUrl() { return wdBase() + 'moyin-meta.json'; }
  function b64u8(s) { return btoa(unescape(encodeURIComponent(String(s)))); }
  /* 唯一的出口：交给本地壳。返回 {status, body}，网络错就 reject。 */
  function wdCall(method, url, body, extra) {
    var fn = window.__moyinWebdav;
    if (typeof fn !== 'function') return Promise.reject(new Error(T('网页版没有本地通道')));
    var head = {};
    if (WD.user) head.Authorization = 'Basic ' + b64u8(WD.user + ':' + WD.pass);
    if (extra) Object.keys(extra).forEach(function (k) { head[k] = extra[k]; });
    return fn({ method: method, url: url, headers: head, body: body == null ? '' : String(body) });
  }
  function wdAuthErr(st) { return st === 401 || st === 403; }
  function wdMkdir() {
    var base = wdBase();
    if (!base) return Promise.resolve(false);
    return wdCall('MKCOL', base).then(function (r) {
      /* 405 = 已经在了，409 = 上级目录不在（服务端不替我们建两层），都当「有了」 */
      return (r.status >= 200 && r.status < 300) || r.status === 405 || r.status === 409;
    }, function () { return false; });
  }
  function wdPull() {
    return wdCall('GET', wdMetaUrl()).then(function (r) {
      if (r.status === 404) return null;              // 第一次用，云端还没有
      if (wdAuthErr(r.status)) throw new Error(T('账号或应用密码不对（WebDAV 要填「应用密码」，不是登录密码）'));
      if (r.status < 200 || r.status >= 300) throw new Error('HTTP ' + r.status);
      var d = null;
      try { d = JSON.parse(r.body); } catch (e) { d = null; }
      if (!d || d.app !== 'MoYinReader' || !Array.isArray(d.books)) throw new Error(T('云端那份不是墨吟的同步文件'));
      return d;
    });
  }
  function wdPut(doc, retried) {
    return wdCall('PUT', wdMetaUrl(), JSON.stringify(doc),
      { 'Content-Type': 'application/json; charset=utf-8' }).then(function (r) {
      if (r.status >= 200 && r.status < 300) return true;
      if (wdAuthErr(r.status)) throw new Error(T('账号或应用密码不对'));
      /* 409：目录还不存在。建一次再传，只重试一次，别死循环。
         手机端的 HttpURLConnection 发不了 MKCOL，所以目录不存在时给句明白话。 */
      if (r.status === 409 && !retried) return wdMkdir().then(function () { return wdPut(doc, true); });
      if (r.status === 409) throw new Error(T('远端目录不存在：把「远端目录」清空，或先在网盘里建好这个文件夹'));
      throw new Error('HTTP ' + r.status);
    });
  }
  /* 上传前先瘦身：chapters（一千条标题）和 cover（base64 图）都能由原文件重新生成，
     传上去只会让清单涨到几 MB。进度和笔记才是这里唯一的正事。 */
  function wdMetaOf(b) {
    return {
      key: b.key || '', name: b.name || '', ext: b.ext || '', size: b.size || 0,
      title: b.title || '', author: b.author || '', tocCount: b.tocCount || 0,
      pages: b.pages || 0, enc: b.enc || '', added: b.added || 0, first: b.first || 0,
      last: b.last || 0, ch: b.ch || 0, ratio: b.ratio || 0, progress: b.progress || 0,
      group: b.group || '', fav: b.fav || 0, rt: b.rt || 0, sessions: b.sessions || 0,
      marks: b.marks || [], hl: b.hl || []
    };
  }
  function wdUnion(x, y, idf) {
    var out = [], seen = {};
    (x || []).concat(y || []).forEach(function (it) {
      if (!it) return;
      var k = idf(it);
      if (seen[k]) return;
      seen[k] = 1; out.push(it);
    });
    return out;
  }
  /* 合并同一本：谁最后读就以谁为主，但进度只许前进，笔记两边都留。
     两边都没动过时结果完全等于本机，不会凭空多出东西。 */
  function wdJoin(a, b) {
    var newer = (Number(a.last) || 0) >= (Number(b.last) || 0) ? a : b;
    var o = {};
    Object.keys(newer).forEach(function (k) { o[k] = newer[k]; });
    o.last = Math.max(Number(a.last) || 0, Number(b.last) || 0);
    o.progress = Math.max(Number(a.progress) || 0, Number(b.progress) || 0);
    /* 章节与页内位置必须跟着「读得更靠后」的那一方，否则会出现进度 60% 却停在第 3 章 */
    var pos = (Number(b.progress) || 0) > (Number(a.progress) || 0) ? b : a;
    o.ch = Number(pos.ch) || 0; o.ratio = Number(pos.ratio) || 0;
    o.marks = wdUnion(a.marks, b.marks, function (x) {
      return (x.ch | 0) + '|' + (x.p | 0) + '|' + (x.text || '');
    });
    o.hl = wdUnion(a.hl, b.hl, function (x) {
      return x.id || ((x.ch | 0) + '|' + (x.p | 0) + '|' + (x.s | 0) + '|' + (x.text || ''));
    });
    o.rt = Math.max(Number(a.rt) || 0, Number(b.rt) || 0);
    o.sessions = Math.max(Number(a.sessions) || 0, Number(b.sessions) || 0);
    var f = [Number(a.first) || 0, Number(b.first) || 0].filter(function (x) { return x > 0; });
    o.first = f.length ? Math.min.apply(null, f) : 0;
    o.added = Number(a.added) || Number(b.added) || 0;
    o.key = a.key || b.key || '';
    return o;
  }
  /* 把合并结果写回本机：只动会变的字段，绝不覆盖 chapters / cover / noFile */
  async function wdLand(b, j) {
    var was = JSON.stringify([b.ch, b.ratio, b.progress, b.last, b.fav, b.group,
      (b.marks || []).length, (b.hl || []).length]);
    b.ch = Number(j.ch) || 0; b.ratio = Number(j.ratio) || 0; b.progress = Number(j.progress) || 0;
    b.marks = j.marks || []; b.hl = j.hl || [];
    b.fav = Number(j.fav) || 0;
    if (j.group) b.group = j.group;
    b.last = Number(j.last) || b.last; b.first = Number(j.first) || b.first;
    b.rt = Math.max(Number(b.rt) || 0, Number(j.rt) || 0);
    b.sessions = Math.max(Number(b.sessions) || 0, Number(j.sessions) || 0);
    var now = JSON.stringify([b.ch, b.ratio, b.progress, b.last, b.fav, b.group,
      (b.marks || []).length, (b.hl || []).length]);
    if (now === was) return false;
    await dbPut('books', b);
    return true;
  }
  /* 合并云端与本地，返回要写回云端的元数据清单 */
  async function wdApply(doc) {
    var remote = (doc && doc.books) || [], i, m;
    var rmap = {}, used = {};
    for (i = 0; i < remote.length; i++) {
      m = remote[i];
      if (m) rmap[m.key || ('id:' + m.id)] = m;
    }
    var out = [], touched = 0, added = 0;
    for (i = 0; i < BOOKS.length; i++) {
      var b = BOOKS[i], fid = b.key || ('id:' + b.id), r = rmap[fid];
      var mine = wdMetaOf(b);
      if (!r) { out.push(mine); continue; }
      used[fid] = 1;
      var j = wdJoin(mine, r);
      out.push(j);
      if (await wdLand(b, j)) touched++;
    }
    /* 云端有、本机没有：建一条「有进度没文件」的条目。书架上看得见进度，
       把原文件导进来，指纹一对上就自动接上——这正是跨设备接着读的用法。 */
    for (i = 0; i < remote.length; i++) {
      m = remote[i];
      if (!m) continue;
      var k2 = m.key || ('id:' + m.id);
      if (used[k2]) continue;
      used[k2] = 1;
      out.push(m);
      var rid = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var nb = {
        id: rid, key: m.key || '', noFile: 1, name: m.name || '', ext: m.ext || '', size: m.size || 0,
        title: m.title || m.name || '', author: m.author || '', tocCount: m.tocCount || 0,
        pages: m.pages || 0, enc: m.enc || '', added: m.added || Date.now(),
        first: m.first || Date.now(), last: m.last || Date.now(),
        ch: m.ch || 0, ratio: m.ratio || 0, progress: m.progress || 0, group: m.group || '',
        fav: m.fav || 0, rt: m.rt || 0, sessions: m.sessions || 0,
        marks: m.marks || [], hl: m.hl || [], chapters: [], cover: ''
      };
      await dbPut('books', nb); BOOKS.push(nb); added++;
    }
    return { books: out, touched: touched, added: added };
  }
  async function wdSync(manual) {
    if (!wdReady()) {
      if (manual) toast(T('网页版不支持网盘同步：要用桌面版或手机版'), 4200);
      return false;
    }
    if (!WD.url) { if (manual) toast(T('先在设置里填 WebDAV 服务器地址')); return false; }
    if (WDBUSY) { if (manual) toast(T('正在同步，稍等')); return false; }
    WDBUSY = 1;
    WD.msg = T('同步中…'); wdSave();
    if (manual) { showSettings(); toast(T('正在和网盘同步…'), 1800); }
    try {
      await ensureKeys(true);                       // 老书先补指纹，不然对不上号
      var doc = await wdPull();
      var r = await wdApply(doc);
      await wdPut({ app: 'MoYinReader', kind: 'meta', v: 1, at: Date.now(), dev: WD.dev, books: r.books });
      WD.at = Date.now();
      WD.msg = T('已同步：本机 {a} 本，云端新增 {b} 本', { a: BOOKS.length, b: r.added });
      wdSave();
      if (r.added || r.touched) renderShelf();
      if (manual) toast(WD.msg, 3200);
      return true;
    } catch (e) {
      WD.msg = T('同步失败：') + ((e && e.message) || T('网络不通'));
      wdSave();
      if (manual) toast(WD.msg, 4600);
      return false;
    } finally { WDBUSY = 0; }
  }
  /* 开机拉一次、离开阅读页推一次（防抖 30 秒）。只有开了开关才动，
     默认一个包都不发——「默认零联网」是这软件摆在第一位的承诺。 */
  function wdAutoPull() {
    if (!WD.on || !WD.url || !wdReady()) return;
    setTimeout(function () { wdSync(false); }, 1200);
  }
  function wdPushSoon() {
    if (!WD.on || !WD.url || !wdReady()) return;
    clearTimeout(WDTIME);
    WDTIME = setTimeout(function () { wdSync(false); }, 30000);
  }
  function wdTest() {
    if (!wdReady()) { toast(T('网页版不支持网盘同步'), 3600); return; }
    if (!WD.url) { toast(T('先填服务器地址')); return; }
    toast(T('正在连接…'), 1600);
    /* 用 GET 探一次而不是 PROPFIND：安卓的 HttpURLConnection 发不了 PROPFIND，
       而「连得上」这件事 200 / 404 都能说明——404 只是还没同步过。 */
    wdCall('GET', wdMetaUrl()).then(function (r) {
      if (wdAuthErr(r.status)) WD.msg = T('账号或应用密码不对');
      else if (r.status === 200) WD.msg = T('连接正常，云端已有同步文件');
      else if (r.status === 404) WD.msg = T('连接正常，云端还没有同步文件（第一次同步会建）');
      else if (r.status === 409) WD.msg = T('连上了，但「远端目录」不存在，清空它或先在网盘里建好');
      else WD.msg = 'HTTP ' + r.status;
    }, function (e) {
      WD.msg = T('连不上：') + ((e && e.message) || T('网络不通'));
    }).then(function () {
      wdSave(); showSettings(); toast(WD.msg, 3600);
    });
  }
  function wdTip() {
    return T('只同步「读到哪儿、书签、批注、分组」，不传书文件：两台机器上各自导入同一个文件，内容指纹一样，进度自动套上，不用搬书。') +
      ' ' + T('应用密码只存在本机，不进备份、不上传。坚果云在「账户信息 → 安全选项 → 添加应用」里生成应用密码，用那个，别用登录密码。') +
      ' ' + T('「远端目录」留空就写在网盘根目录（文件叫 moyin-meta.json）；想放子文件夹，先在网盘里建好再填名字。') +
      ' ' + T('⚠ 这是第一版，还没在真实网盘上跑过（手边没有网盘账号）：连不上、同步不上都属正常，把现象告诉我，我来修。功能默认关着，不开不会影响看书。');
  }

  /* ---------------- 事件 ---------------- */
  /* 手机顶栏的「⋯ 更多」：默认只露 5 个常用键，点开才摊平其余动作。
     点其中任何一个都会自动收起，免得挡住正文。 */
  function bindMore(btnId, boxId) {
    var b = $(btnId), box = $(boxId);
    if (!b || !box) return;
    function shut() {
      box.classList.remove('open');
      b.textContent = '⋯';
      b.setAttribute('aria-expanded', 'false');
    }
    box.__shut = shut;          // 外面（收工具栏、换章）也能把它关掉
    b.onclick = function (e) {
      e.stopPropagation();
      var on = !box.classList.contains('open');
      box.classList.toggle('open', on);
      b.textContent = on ? '×' : '⋯';
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
    };
    box.addEventListener('click', function (e) {
      if (e.target.closest('.only-narrow')) return;
      if (e.target.tagName === 'BUTTON') setTimeout(shut, 80);
    });
    // 换页 / 换视图时收起来，别把上一次展开的状态带到新页面
    window.addEventListener('resize', shut);
  }
  function bind() {
    $('btnImport').onclick = function () { $('fileInput').click(); };
    $('fileInput').onchange = function (e) { if (e.target.files.length) importFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ''; };
    $('btnImportDir').onclick = importFolder;
    // 「网络位置」只在桌面版出现：网页版没有本地文件权限，SMB 更无从谈起
    if (typeof window.__moyinScanDir === 'function') {
      $('btnImportNet').hidden = false;
      $('btnImportNet').onclick = importNet;
    }
    $('dirInput').onchange = function (e) {
      var fs = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (fs.length) importFiles(fs);
    };
    $('btnLang').onclick = function () { setLang(CFG.lang === 'en' ? 'zh' : 'en'); };
    $('btnShelves').onclick = showShelves;
    $('btnNotes').onclick = function () { openSide('note'); };
    $('shelfBar').onclick = function (e) {
      var b = e.target.closest('[data-sv]'); if (!b) return;
      var v = b.getAttribute('data-sv');
      if (v === '__new') { showShelves(); return; }
      CFG.shelfView = v; saveCfg(); renderShelf();
    };
    $('selExit').onclick = exitSel;
    $('selAll').onclick = function () {
      var list = shelfList(), all = list.length && list.every(function (b) { return SELS[b.id]; });
      list.forEach(function (b) { SELS[b.id] = !all; });
      renderShelf();
    };
    $('selMove').onclick = askBatchMove;
    $('selFav').onclick = batchFav;
    $('selDel').onclick = batchDel;
    $('libSearch').oninput = renderShelf;
    $('btnSort').onclick = function () {
      var a = ['last', 'name', 'added', 'progress'];
      CFG.sort = a[(a.indexOf(CFG.sort) + 1) % a.length]; saveCfg(); renderShelf();
      toast(T('排序：' + ({ last: '最近阅读', name: '书名', added: '加入时间', progress: '阅读进度' })[CFG.sort]));
    };
    $('btnLayout').onclick = function () { showType(); };
    $('btnCfg').onclick = showSettings;
    $('btnTheme').onclick = function () { showTheme(); };
    $('btnExport').onclick = askExport;
    $('btnImportBak').onclick = function () { $('bakInput').click(); };
    $('bakInput').onchange = function (e) { if (e.target.files[0]) importBak(e.target.files[0]); e.target.value = ''; };
    $('shelf').onclick = function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) { toggleFav(fav.getAttribute('data-fav')); return; }
      var more = e.target.closest('[data-more]');
      if (more) { openBookMenu(more.getAttribute('data-more')); return; }
      var li = e.target.closest('[data-listen]');
      if (li) { resumeListen(li.getAttribute('data-listen')); return; }
      var card = e.target.closest('.bk');
      if (card) {
        var id = card.getAttribute('data-id');
        if (document.body.classList.contains('selmode')) { toggleSel(id); return; }
        openBook(id);
      }
    };
    $('btnBack').onclick = closeBook;
    $('btnSign').onclick = function () { showDoc('about'); };
    $('btnPrevCh').onclick = function () { nextCh(-1); };
    $('btnNextCh').onclick = function () { nextCh(1); };
    $('progRange').oninput = function () {
      if (!BK) return;
      var i = Math.floor(this.value / 1000 * chapterCount());
      renderChapter(Math.min(chapterCount() - 1, i));
    };
    bindMore('btnMore', 'readActs');
    bindMore('btnMoreLib', 'libActs');
    $('btnToc').onclick = function () { openSide('toc'); };
    $('btnMarks').onclick = function () { openSide('mark'); };
    $('btnFind').onclick = function () { openSide('find'); };
    $('btnMarkAdd').onclick = addMark;
    $('btnType').onclick = function () { showType(); };
    $('btnAuto').onclick = function () { autoToggle(); };
    $('btnFull').onclick = toggleFull;
    $('btnSet').onclick = function () { showSettings(); };
    $('clock').onclick = function () { showClockPanel(); };
    $('restTipOk').onclick = restTake;
    $('restTipSnooze').onclick = restSnooze;
    $('autoPillGo').onclick = function () { autoResume(); };
    $('autoPillX').onclick = function () { autoStop(); };
    document.addEventListener('fullscreenchange', function () { syncFullBtn(); if (BK && pgEnabled()) setTimeout(pgReflow, 120); });
    document.addEventListener('webkitfullscreenchange', function () { syncFullBtn(); });
    $('btnSpeak').onclick = function () {
      if (!SPK.on || !$('speakBar').classList.contains('on')) startSpeak(currentPara());
      else toggleSpeak();
    };
    $('side').querySelectorAll('.tabs button[data-tab]').forEach(function (b) {
      b.onclick = function () { openSide(b.getAttribute('data-tab')); };
    });
    $('sideClose').onclick = closeSide;
    /* 拖文件进来就能导入：桌面阅读器的基本操作，别让人非得点「导入」再翻目录 */
    (function () {
      var depth = 0;
      function hasFiles(e) {
        var t = e.dataTransfer && e.dataTransfer.types;
        return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0;
      }
      window.addEventListener('dragenter', function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth++; $('dropHint').classList.add('on');
      });
      window.addEventListener('dragover', function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      });
      window.addEventListener('dragleave', function (e) {
        if (!hasFiles(e)) return;
        depth = Math.max(0, depth - 1);
        if (!depth) $('dropHint').classList.remove('on');
      });
      window.addEventListener('drop', function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth = 0; $('dropHint').classList.remove('on');
        var fs = Array.prototype.slice.call(e.dataTransfer.files || []);
        var good = fs.filter(function (f) { return readExt(f.name); });
        if (!good.length) {
          toast(fs.length ? T('拖进来的不是 TXT / EPUB，读不了这些文件') : T('没识别到文件'), 3600);
          return;
        }
        importFiles(good);   // 正在看书也不打断，导入完在书架里能看到
      });
    })();
    $('imgView').onclick = hideImg;
    $('sideBody').oninput = function (e) {
      if (e.target && e.target.id === 'tocQ') {
        TOC_Q = e.target.value;
        var list = $('tocList');
        if (list) list.innerHTML = tocListHTML(TOC_Q);
      }
    };
    $('sideBody').onclick = function (e) {
      var dm = e.target.closest('[data-delmark]');
      if (dm) {
        var ts = Number(dm.getAttribute('data-delmark'));
        BK.meta.marks = (BK.meta.marks || []).filter(function (m) { return m.ts !== ts; });
        savePos(); renderSide(); return;
      }
      if (e.target.closest('#sideAddMark')) { addMark(); return; }
      var nf = e.target.closest('[data-nf]');
      if (nf) { CFG.noteFilter = nf.getAttribute('data-nf'); saveCfg(); renderSide(); return; }
      if (e.target.closest('#noteExp')) { exportNotes(); return; }
      if (e.target.closest('#noteSum')) { showSummary(); return; }
      var he = e.target.closest('[data-hledit]');
      if (he) { noteEditor(hlById(he.getAttribute('data-hledit'))); return; }
      var hs = e.target.closest('[data-hlshare]');
      if (hs) { shareHighlight(hlById(hs.getAttribute('data-hlshare'))); return; }
      var hd = e.target.closest('[data-hldel]');
      if (hd) { removeHighlight(hd.getAttribute('data-hldel')); return; }
      var hg = e.target.closest('[data-hlgo]');
      if (hg) { gotoHighlight(hlById(hg.getAttribute('data-hlgo'))); return; }
      var m = e.target.closest('[data-mark]');
      if (m) {
        var mk = BK.meta.marks.slice().sort(function (a, c) { return c.ts - a.ts; })[Number(m.getAttribute('data-mark'))];
        if (mk) { renderChapter(mk.ch, { silent: true }); setTimeout(function () { var p = SPK.paras[mk.p]; if (p) revealPara(p); }, 90); }
        return;
      }
      var t = e.target.closest('[data-ch]');
      if (t) { renderChapter(Number(t.getAttribute('data-ch')), { anchor: t.getAttribute('data-anchor') }); }
    };
    $('page').onclick = function (e) {
      var nx = e.target.closest('[data-act="next"]'); if (nx) { nextCh(1); return; }
      var mk = e.target.closest('mark[data-hlid]');
      if (mk) { hideSelTools(); hlMenu(mk.getAttribute('data-hlid')); return; }
      var a = e.target.closest('a[data-ch]');
      if (a) { e.preventDefault(); renderChapter(Number(a.getAttribute('data-ch')), { anchor: a.getAttribute('data-anchor') }); return; }
      var p = e.target.closest('.rdp');
      if (p && SPK.on) {
        var i = SPK.paras.indexOf(p);
        if (i >= 0) { SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT); stopLocalAudio(); clearPref(); try { SYN.cancel(); } catch (er) {} setPara(i); highlight(); if (SPK.playing) speakChunk(0); }
      }
    };
    /* 选中文字 → 浮动工具条（桌面上 mouseup，触屏上 touchend） */
    $('page').addEventListener('mouseup', onSelUp);
    $('page').addEventListener('touchend', function () { setTimeout(onSelUp, 60); });
    /* 点正文：左 1/3 上一页、右 1/3 下一页、中间收 / 放上下工具栏（有选区时不动）。
       手机没有键盘也没有滚轮，点一下就翻最省事；中间那块留给选字、点链接、
       点「朗读从这里念」，也用来收起顶栏（顶栏一直占着最上面一条太挤）。 */
    $('pageWrap').addEventListener('click', function (e) {
      if (e.target.closest('#selTools')) return;
      if (Date.now() - TAPMOVE < 700) return;          // 刚才是滑动，不是轻点
      var imHit = e.target.closest('#page img');
      if (imHit && imHit.getAttribute('src')) { showImg(imHit.getAttribute('src')); return; }
      var s = window.getSelection();
      var hasSel = !!(s && !s.isCollapsed);
      if ($('side').classList.contains('on')) { if (!hasSel) closeSide(); return; }
      if (hasSel) return;
      if (e.target.closest('a,button,mark,[data-act]')) return;
      if (SPK.on && e.target.closest('.rdp')) return;          // 朗读中点段落 = 从这里念
      var box = $('pageWrap').getBoundingClientRect();
      var x = e.clientX - box.left, y = e.clientY - box.top;
      /* 工具栏收着时，点屏幕最上面那条窄边就能唤回来，不用猜 */
      if (!barsVisible() && y < 54) { setBars(true); return; }
      if (!pgEnabled()) {
        /* 图片层 PDF：点左右半边翻页。整页图上没有字可选、没有链接可点，
           在这儿点一下除了翻页没别的心思。 */
        if (BK && BK.picture) {
          if (x < box.width / 3) { autoPause(); readPrev(); return; }
          if (x > box.width * 2 / 3) { autoPause(); readNext(); return; }
        }
        if (touchy()) toggleBars();            // 滚动模式：点一下收 / 放工具栏
        return;
      }
      if (x < box.width / 3) { autoPause(); readPrev(); }
      else if (x > box.width * 2 / 3) { autoPause(); readNext(); }
      else toggleBars();
    });
    /* 滚轮翻页（翻页模式） */
    var wheelT = 0, TAPMOVE = 0;        // TAPMOVE：最近一次手指移动的时间，用来区分轻点与滑动
    $('pageWrap').addEventListener('wheel', function (e) {
      autoPause();
      if (!pgEnabled()) return;
      var now = Date.now();
      if (now - wheelT < 240) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 6) return;
      wheelT = now; e.preventDefault();
      if (e.deltaY > 0) readNext(); else readPrev();
    }, { passive: false });
    /* 左右滑动翻页（触屏）+ 双指捏合调字号 */
    var tx0 = 0, ty0 = 0, tt0 = 0;
    var pinch = { on: false, d0: 0, fs0: 0 };
    function touchDist(e) {
      var a = e.touches[0], b = e.touches[1];
      if (!a || !b) return 0;
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    $('pageWrap').addEventListener('touchstart', function (e) {
      autoPause();
      if (e.touches.length >= 2) {          // 两指 = 调字号，不参与翻页
        pinch.on = true;
        pinch.d0 = touchDist(e) || 1;
        pinch.fs0 = Number(CFG.fs) || 19;
        return;
      }
      pinch.on = false;
      var t = e.touches[0]; if (!t) return;
      tx0 = t.clientX; ty0 = t.clientY; tt0 = Date.now();
    }, { passive: true });
    $('pageWrap').addEventListener('touchmove', function (e) {
      if (!pinch.on || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      var d = touchDist(e);
      if (!d) return;
      var fs = Math.round(pinch.fs0 * (d / pinch.d0));
      fs = Math.max(13, Math.min(40, fs));
      if (fs !== Number(CFG.fs)) { CFG.fs = fs; applyCfg(); }   // 整数档变了才重排
    }, { passive: false });
    $('pageWrap').addEventListener('touchend', function (e) {
      if (pinch.on) {
        pinch.on = false;
        saveCfg();
        toast(T('字号 {n}', { n: CFG.fs }), 1200);
        return;
      }
      var t = (e.changedTouches && e.changedTouches[0]) || null; if (!t) return;
      var dx = t.clientX - tx0, dy = t.clientY - ty0;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) TAPMOVE = Date.now();   // 手指动过 → 不算轻点
      if (!pgEnabled()) return;
      if (Date.now() - tt0 > 900) return;
      if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      var s = window.getSelection(); if (s && !s.isCollapsed) return;
      if (dx < 0) readNext(); else readPrev();
    }, { passive: true });
    $('pageWrap').addEventListener('scroll', hideSelTools);
    $('selTools').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('selTools').onclick = function (e) {
      var sw = e.target.closest('[data-hl]'), act = e.target.closest('[data-sel]');
      if (sw) { addHighlight(sw.getAttribute('data-hl')); return; }
      if (!act) return;
      var a = act.getAttribute('data-sel');
      if (a === 'note') { var hl = addHighlight('y'); if (hl) noteEditor(hl); return; }
      if (a === 'copy') { copyText(SEL.text).then(function (ok) { toast(ok ? T('已复制') : T('复制失败，请手动选择文本')); }); hideSelTools(); return; }
      if (a === 'share') { shareHighlight({ text: SEL.text, ch: SEL.ch }); hideSelTools(); return; }
    };
    $('pageWrap').onscroll = function () { updateProgress(); savePos(); };
    $('spPlay').onclick = toggleSpeak;
    $('spStop').onclick = function () { stopSpeak(false); toast(T('已停止朗读')); };
    $('spPrev').onclick = function () { speakJump(-1); };
    $('spNext').onclick = function () { speakJump(1); };
    $('spClose').onclick = function () { stopSpeak(true); };
    $('spVoice').onchange = function () {
      var v = this.value;
      if (v === '__more' || v === '__pins') {    // 挑更多 / 增删置顶：都去设置页
        this.value = 'local:' + CFG.localVoice; showSettings(); return;
      }
      /* leadm:s32 / leadf:s13 —— 这一项不是「切声线」，是「把这个声线指给主角」。
         下拉本身要回弹到当前旁白，不然看着像旁白也跟着换了。 */
      if (v.indexOf('lead') === 0) {
        var lg = v.charAt(4), lk = v.slice(6);
        this.value = 'local:' + CFG.localVoice;
        setLead(lg === 'm' ? 'm' : 'f', lk);
        return;
      }
      if (v.indexOf('narr:') === 0) {           // 整本换旁白性别
        this.value = 'local:' + CFG.localVoice;
        setNarr(v.charAt(5) === 'm' ? 'm' : 'f');
        return;
      }
      if (v.indexOf('local:') === 0) {          // 本机声线：换完立刻用新音色重念当前段
        CFG.localVoice = v.slice(6); CFG.voiceAuto = 0;
        if (voiceGender(CFG.localVoice) === 'm') CFG.narrM = CFG.localVoice;
        else CFG.narrF = CFG.localVoice;
        saveCfg();
        resetCast();                            // 旁白换了，角色池要重新避开新声线
        voiceBadge(null);
        /* 和 pickLocalVoice 保持同一套：配角声线要先把 187 人语音库叫醒。
           朗读条上直接下拉也是「朗读中换声线」的主要路径，这里不能漏。 */
        var libV = /^s\d+$/.test(CFG.localVoice), warmingV = libV && !LOCAL.lib;
        if (libV) warmLib(true, 0);
        if (SPK.playing) { speakJump(0); }
        if (warmingV) {
          toast(T('{v}：187 人语音库正在准备，开头一两句可能跳过，好了自动接上',
            { v: localVoiceName(CFG.localVoice) }), 5600);
        } else if (!SPK.playing) {
          toast(T('音色已切到 ') + localVoiceName(CFG.localVoice) + T('（本机离线合成）'), 2600);
        }
        return;
      }
      CFG.voiceURI = v; CFG.voiceAuto = 0; SPK.fb = 0; SPK.seenEnd = false;
      saveCfg(); voiceBadge(curVoice());
      if (SPK.playing) { speakJump(0); }
    };
    $('spRole').onclick = function () { toggleRole(); };
    $('spTry').onclick = tryVoice;
    $('spQuality').onclick = function () { showDoc(localReady() ? 'local' : 'voice'); };
    $('spRate').oninput = function () {
      CFG.rate = parseFloat(this.value); $('spRateTx').textContent = CFG.rate.toFixed(1) + '×'; saveCfg();
      if (SPK.audio) SPK.audio.playbackRate = CFG.rate;
    };
    $('spTimer').onchange = function () { speakTimer(Number(this.value)); };
    $('modalX').onclick = closeModal;
    $('modal').onclick = function (e) { if (e.target === $('modal')) closeModal(); };
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-doc]'); if (d) { showDoc(d.getAttribute('data-doc')); }
    });
    document.addEventListener('keydown', function (e) {
      if ($('modal').classList.contains('on')) { if (e.key === 'Escape') closeModal(); return; }
      if (e.key === 'Escape') {
        if ($('imgView').classList.contains('on')) { hideImg(); return; }
        if ($('selTools').classList.contains('on')) { hideSelTools(); return; }
        if (AUTO.on) { autoStop(); return; }
        if (inImm() || isFull()) {
          CFG.immersive = 0; saveCfg(); applyImm();
          try { if (isFull()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var r = ex.call(document); if (r && r.catch) r.catch(function () { }); } } } catch (er) { }
          return;
        }
        if ($('side').classList.contains('on')) $('side').classList.remove('on');
        else if ($('viewRead').classList.contains('on')) closeBook();
        return;
      }
      if (!$('viewRead').classList.contains('on')) return;
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'F11') { toggleFull(); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { autoPause(); readPrev(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { autoPause(); readNext(); e.preventDefault(); }
      else if (e.key === ' ') {
        if (SPK.on) { toggleSpeak(); e.preventDefault(); }
        else if (AUTO.on) { autoToggle(); e.preventDefault(); }
        else { autoPause(); readNext(); e.preventDefault(); }
      }
      else if (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey)) { openSide('find'); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_')) {
        var up = (e.key === '=' || e.key === '+');
        CFG.fs = Math.max(13, Math.min(34, Number(CFG.fs) + (up ? 1 : -1)));
        saveCfg(); applyCfg(); toast(T('字号') + ' ' + CFG.fs + 'px', 1200); e.preventDefault();
      }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') { showTheme(); e.preventDefault(); }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') { autoToggle(); e.preventDefault(); }
    });
    /* 沉浸模式：鼠标移到上下边缘唤出工具栏 */
    document.addEventListener('mousemove', function (e) {
      if (!document.body.classList.contains('imm')) return;
      var t = $('readTop').offsetHeight || 48, b = $('readFoot').offsetHeight || 44;
      $('readTop').classList.toggle('peek', e.clientY <= t + 6);
      $('readFoot').classList.toggle('peek', e.clientY >= window.innerHeight - b - 6);
    });
    /* 窗口尺寸变化：翻页模式重新分页 */
    var rzT = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzT);
      rzT = setTimeout(function () {
        if (!BK) return;
        if (pgEnabled()) pgReflow(); else updateProgress();
      }, 180);
    });
    /* 正文容器尺寸变了（开合侧栏、进出沉浸、窗口缩放）也重新分页 */
    pgWatch();
    if (SYN && SYN.addEventListener) SYN.addEventListener('voiceschanged', fillVoices);
    if (SYN && 'onvoiceschanged' in SYN) SYN.onvoiceschanged = fillVoices;
    window.addEventListener('beforeunload', function () { try { savePos(); rtFlush(); } catch (e) { } });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { try { rtFlush(); savePos(); } catch (e) { } clkStop(); }
      else if (BK) { rtStart(BK.id); if ($('viewRead').classList.contains('on')) clkStart(); }
    });
  }

  async function init() {
    loadCfg(); loadStats(); bind(); fillVoices(); syncRoleBtn(); syncLangBtn(); syncTypeBtn(); syncAutoBtn(); syncFullBtn();
    wdLoad();
    if (I18N) I18N.apply();
    // 自动探测本机免费神经语音引擎；没启动时静默用系统语音，不打扰
    localProbe();
    /* 第一次打开：主动暖一下引擎，就绪后弹「挑一个声音」（见 maybeIntro）。
       老用户不暖——没打算听的十几秒不该白等。 */
    if (!CFG.introRev) setTimeout(function () { if (!CFG.introRev) { warmEngine(); } }, 1500);
    setInterval(function () {
      if (CFG.localOn && !LOCAL.ready && LOCAL.miss < 5 && document.visibilityState === 'visible') localProbe();
    }, 12000);
    // 非 Edge 浏览器通常拿不到中文在线自然语音，给一次不打扰的引导
    if (SYN) setTimeout(function () {
      var vs = SYN.getVoices() || [];
      if (!vs.some(function (v) { return isNatural(v) && isZh(v); }) && !/Edg\//.test(navigator.userAgent) && !localReady())
        toast(T('当前浏览器没有中文自然语音；装一次免费离线语音包即可听到接近真人的朗读'), 6500);
    }, 2400);
    try { BOOKS = (await dbAll('books')) || []; } catch (e) { BOOKS = []; toast(T('本机存储不可用，书籍将无法保存'), 5000); }
    renderShelf();
    /* 老书补指纹、开了同步就去拉一次云端进度。都排在书架出来之后，不挡首屏 */
    setTimeout(function () { ensureKeys(true); }, 2000);
    wdAutoPull();
    window.MY = {
      Z: Z, CFG: CFG, get BK() { return BK; }, get SPK() { return SPK; }, get BOOKS() { return BOOKS; },
      /* 安卓返回键：页面能自己处理就返回 true，处理不了（书架页）才让应用退出。
         顺序照常识来：先关弹窗，再收侧栏，最后才是从书里退回书架。 */
      backKey: function () {
        try {
          if ($('modal').classList.contains('on')) { closeModal(); return true; }
          if (document.body.classList.contains('selmode')) { enterSelMode(false); return true; }
          if ($('side').classList.contains('on')) { closeSide(); return true; }
          if (document.getElementById('viewRead').classList.contains('on')) { closeBook(); return true; }
        } catch (e) { /* 状态不全时不拦退出 */ }
        return false;
      },
      parseBook: parseBook, openBook: openBook, renderChapter: renderChapter, importFiles: importFiles,
      importFolder: importFolder, openSide: openSide, closeSide: closeSide,
      importBuffer: async function (buf, name, ext) {
        var e0 = ext || readExt(name) || sniffExt(buf);
        var bkey = bookKey(buf, name.replace(/\.[^.]+$/, ''), buf.byteLength);
        var b = await parseBook(buf, name, e0);
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf, text: b.pdfText || b.fmtText || '' });
        var m = { id: id, key: bkey, name: name.replace(/\.[^.]+$/, ''), ext: e0, size: buf.byteLength, pages: b.pdfPages || 0,
          picture: b.picture ? 1 : 0, pdfWhy: b.pdfWhy || '',
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0, cover: b.cover || '',
          title: b.title, author: b.author || '', marks: [], hl: [], chapters: b.titles.slice(0, 1000),
          tocCount: b.toc.length, enc: b.enc || '', group: '', fav: 0, rt: 0, sessions: 0, first: 0 };
        adoptByKey(m);
        await dbPut('books', m); BOOKS.push(m); renderShelf(); return id;
      },
      exportBak: exportBak, importBak: importBak, dbGet: dbGet, dbAll: dbAll,
      /* 内容指纹与网盘同步（测试脚本要能直接调） */
      WD: WD, wdReady: wdReady, wdBase: wdBase, wdMetaOf: wdMetaOf, wdJoin: wdJoin,
      wdApply: wdApply, wdSync: wdSync, wdTest: wdTest, wdLoad: wdLoad, wdSave: wdSave,
      bookKey: bookKey, sha256Hex: sha256Hex, utf8Bytes: utf8Bytes, normBookName: normBookName,
      ensureKeys: ensureKeys, adoptByKey: adoptByKey, wdPushSoon: wdPushSoon,
      startSpeak: startSpeak, stopSpeak: stopSpeak, toggleSpeak: toggleSpeak,
      doFind: doFind, addMark: addMark, showDoc: showDoc, closeBook: closeBook,
      diagText: diagText, copyDiag: copyDiag, packCard: packCard,
      fillVoices: fillVoices, splitSpeak: splitSpeak, normSpeak: normSpeak,
      voiceLabel: voiceLabel, voiceTier: voiceTier, isNatural: isNatural,
      tryVoice: tryVoice, showSettings: showSettings,
      localURL: localURL, localReady: localReady, localProbe: localProbe, LOCAL: LOCAL,
      fixLocalVoice: fixLocalVoice, localVoiceList: localVoiceList, LOCAL_VOICES: LOCAL_VOICES, saveCfg: saveCfg,
      stopLocalAudio: stopLocalAudio,
      chapterCount: chapterCount, chapterTitle: chapterTitle, currentPara: currentPara,
      resumeListen: resumeListen, renderShelf: renderShelf,
      roleSegments: roleSegments, castVoice: castVoice, rolePool: rolePool, resetCast: resetCast,
      tryRole: tryRole, toggleRole: toggleRole, localBarList: localBarList, voiceStat: voiceStat,
      /* 1.14.23：朗读条置顶（测试脚本要能直接调） */
      pinVoice: pinVoice, unpinVoice: unpinVoice, pinKeys: pinKeys, pinChips: pinChips,
      coreVoiceKeys: coreVoiceKeys, isCoreVoice: isCoreVoice, localBarGroups: localBarGroups,
      pickLocalVoice: pickLocalVoice, PIN_MAX: PIN_MAX, PIN_PER_GENDER: PIN_PER_GENDER,
      voiceGender: voiceGender, pinSlot: pinSlot, fixPinBalance: fixPinBalance,
      autoRetime: autoRetime, autoPageSec: autoPageSec,
      buildVoiceList: buildVoiceList, setPara: setPara, speakerOf: speakerOf,
      VER: VER, setLang: setLang, STATS: STATS, loadStats: loadStats, fmtDur: fmtDur, statStreak: statStreak,
      noteEditor: noteEditor, hlMenu: hlMenu, removeHighlight: removeHighlight, hlList: hlList,
      notesMarkdown: notesMarkdown, exportNotes: exportNotes, showSummary: showSummary,
      shareHighlight: shareHighlight, applyHighlights: applyHighlights, persistBook: persistBook,
      showShelves: showShelves, toggleFav: toggleFav, shelfList: shelfList, enterSelMode: enterSelMode,
      openBookMenu: openBookMenu, copyText: copyText, rtFlush: rtFlush, saveStats: saveStats,
      /* 1.8：排版 / 分页 / 自动阅读 / 全屏 */
      showType: showType, showTheme: showTheme, showClockPanel: showClockPanel,
      hansify: hansify, showText: showText, showImg: showImg, hideImg: hideImg,
      showView: showView, openBook: openBook, renderSide: renderSide,
      importNet: importNet, applyScan: applyScan, importFolder: importFolder,
      CLK: CLK, clkStart: clkStart, clkStop: clkStop, clkPaint: clkPaint, clkTick: clkTick,
      showRest: showRest, hideRest: hideRest, LAYN: LAYN,
      clkReset: clkReset, restTake: restTake, restSnooze: restSnooze, fmtRead: fmtRead, PG: PG, pgEnabled: pgEnabled, pgCols: pgCols, pgMeasure: pgMeasure,
      applyCfg: applyCfg, scrollTopPara: scrollTopPara,
      pgTo: pgTo, pgReflow: pgReflow, paraPage: paraPage, readNext: readNext, readPrev: readPrev,
      autoToggle: autoToggle, autoStart: autoStart, autoStop: autoStop, autoPause: autoPause,
      autoResume: autoResume, AUTO: AUTO, toggleFull: toggleFull, setTheme: setTheme,
      applyImm: applyImm, setBars: setBars, toggleBars: toggleBars, barsVisible: barsVisible,
      THEMES: THEMES, revealPara: revealPara, renderKeep: renderKeep,
      /* 1.11.1：检查更新（测试脚本要能直接调） */
      checkUpdate: checkUpdate, cmpVer: cmpVer, UPD: UPD
    };
    document.documentElement.setAttribute('data-ready', '1');
    webEditionTip();
    autoCheckUpdate();
  }

  /* 自动查新：默认关（守「零联网」），开了也一天最多查一次，且延后几秒，不跟首屏抢网络 */
  function autoCheckUpdate() {
    if (Number(CFG.updChk) !== 1) return;
    var last = 0;
    try { last = Number(localStorage.getItem('moyin.updAt') || 0); } catch (e) { }
    if (Date.now() - last < 86400000) return;
    setTimeout(function () {
      try { localStorage.setItem('moyin.updAt', String(Date.now())); } catch (e) { }
      checkUpdate(false);
    }, 4000);
  }

  /* 在线版（GitHub Pages）提示：网页里只有系统语音，别让人以为声线坏了 */
  function webEditionTip() {
    if (!/\.github\.io$/i.test(location.hostname)) return;
    var tip = document.getElementById('webTip');
    if (!tip) return;
    var off = false;
    try { off = localStorage.getItem('moyin.webTip') === 'off'; } catch (e) { }
    if (off) return;
    tip.hidden = false;
    var x = document.getElementById('webTipX');
    if (x) x.onclick = function () {
      tip.hidden = true;
      try { localStorage.setItem('moyin.webTip', 'off'); } catch (e) { }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
