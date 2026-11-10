export const WORLD_KEY='micra-rails.world.v1';
export const WORLDS={
 grass:{difficulty:1,name:'草原',rule:'入れ替え',description:'2枚を選んで交換・停車中は追跡も停止',shinyRate:.05,bossRate:.01,aInterval:2400,bInterval:2200,pausePursuitOnBrake:true,salt:0x4a371b29,featured:['pig','cow','wolf','cat','allay','bee','panda']},
 mine:{difficulty:'EX',name:'廃坑',rule:'回転',description:'先を読んで回転・大人向け',shinyRate:.08,bossRate:.02,aInterval:2200,bInterval:2000,pausePursuitOnBrake:false,salt:0x1ba92f35,featured:['creeper','zombie','skeleton','iron-golem','copper-golem','spider','cave-spider','warden']},
 nether:{difficulty:3,name:'ネザー',rule:'配置',description:'次に出る線路を空きマスへ置く',shinyRate:.12,bossRate:.04,aInterval:2100,bInterval:1850,pausePursuitOnBrake:false,salt:0x7246d01f,featured:['piglin','piglin-brute','zombified-piglin','ghast','happy-ghast','ghastling','blaze','magma-cube','wither']},
 end:{difficulty:4,name:'エンド',rule:'スライド',description:'空きマスへ動かすスライドパズル',shinyRate:.18,bossRate:.06,aInterval:1900,bInterval:1700,pausePursuitOnBrake:false,salt:0,featured:['enderman','endermite','shulker','ender-dragon']},
};
export const isWorld=id=>typeof id==='string'&&Object.hasOwn(WORLDS,id);
export function loadWorld(storage){try{const data=JSON.parse(storage?.getItem(WORLD_KEY)||'null');if(isWorld(data?.id))return data.id}catch{}return 'grass'}
export function saveWorld(storage,id){if(!isWorld(id))return false;try{storage?.setItem(WORLD_KEY,JSON.stringify({id}))}catch{}return true}
export function featuredWeight(character,worldId){return (WORLDS[isWorld(worldId)?worldId:'end']).featured.includes(character.id)?4:1}
