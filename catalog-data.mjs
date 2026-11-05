export const CATEGORIES=[
 {id:'friends',name:'なかま',color:'#75b9b4'},
 {id:'animals',name:'どうぶつ',color:'#b6ba78'},
 {id:'monsters',name:'モンスター',color:'#8aaa6d'},
 {id:'bosses',name:'ボス',color:'#b697d1'},
];
// Add the final supplied portrait to image. IDs are permanent save-data keys.
export const CHARACTERS=[
 {id:'steve',name:'スティーブ',category:'friends',color:'#24acb5',skin:'#b78156',image:'assets/steve.png',fact:'ブロックを集めて、道をつくる冒険者。この坑道ではトロッコに乗って進むよ。'},
 {id:'alex',name:'アレックス',category:'friends',color:'#749b4a',skin:'#edb48a',fact:'オレンジ色の髪が目じるしの冒険者。道具を使って、いろいろなものをつくるよ。'},
 {id:'villager',name:'村人',category:'friends',color:'#9a7854',skin:'#ba8f69',fact:'村で暮らすなかま。仕事をして、エメラルドで品物を交換してくれるよ。'},
 {id:'iron-golem',name:'アイアンゴーレム',category:'friends',color:'#c2c3af',skin:'#d0d0be',fact:'鉄のからだを持つ、大きな村の守り手。村人をモンスターから守るよ。'},
 {id:'pig',name:'ブタ',category:'animals',color:'#db969f',skin:'#e8a3ad',fact:'ピンク色のどうぶつ。にんじんを持つと、あとをついてくるよ。'},
 {id:'cow',name:'ウシ',category:'animals',color:'#725b49',skin:'#c7bb9e',fact:'茶色と白のもようが目じるし。バケツを使うと、ミルクをもらえるよ。'},
 {id:'wolf',name:'オオカミ',category:'animals',color:'#b0b2ad',skin:'#d6d7ce',fact:'森などにいるどうぶつ。骨をあげて、なかよくなることができるよ。'},
 {id:'cat',name:'ネコ',category:'animals',color:'#c08a58',skin:'#d5b18b',fact:'村などで会えるどうぶつ。魚をあげてなかよくなると、あとをついてくるよ。'},
 {id:'creeper',name:'クリーパー',category:'monsters',color:'#6caf3c',skin:'#7fc24d',image:'assets/creeper.png',fact:'緑色のからだで、そっと近づくモンスター。近くに来ると「シュー……」と音を立てて爆発！'},
 {id:'zombie',name:'ゾンビ',category:'monsters',color:'#479d9d',skin:'#698949',fact:'暗いところから現れるモンスター。昼の太陽の光が苦手だよ。'},
 {id:'skeleton',name:'スケルトン',category:'monsters',color:'#c9c8b7',skin:'#dedac8',fact:'骨のからだを持つモンスター。弓を使って、遠くから矢を飛ばしてくるよ。'},
 {id:'enderman',name:'エンダーマン',category:'monsters',color:'#37333e',skin:'#403548',fact:'長い手足と紫色の目が目じるし。テレポートして、別の場所に移動できるよ。'},
 {id:'ender-dragon',name:'エンダードラゴン',category:'bosses',color:'#614c79',skin:'#352b43',fact:'ジ・エンドを飛ぶ、大きなドラゴン。黒いからだと、大きな翼を持っているよ。'},
 {id:'wither',name:'ウィザー',category:'bosses',color:'#58545b',skin:'#464249',fact:'３つの頭を持つボス。空を飛びながら、黒い頭の形の弾を飛ばしてくるよ。'},
];
export const BY_ID=Object.fromEntries(CHARACTERS.map(c=>[c.id,c]));
export const SAVE_KEY='micra-rails.collection.v1';
export const BREAK_HITS=5;
