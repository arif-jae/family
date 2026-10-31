(function(root){
  function merge(records){
    const priority=p=>p.can_delete===true?2:p.can_edit!==false?1:0;
    const sorted=[...records].sort((a,b)=>priority(b)-priority(a)||a.id-b.id);
    const identities=new Map(), aliases=new Map();
    for(const p of sorted){const key=p.national_id||`record:${p.id}`;if(!identities.has(key))identities.set(key,{...p,parents:[],fathers:[],mothers:[],partners:[],sources:[]});aliases.set(p.id,identities.get(key).id);identities.get(key).sources.push(p.id);}
    const result=[...identities.values()],byId=new Map(result.map(p=>[p.id,p]));
    for(const p of records){const target=byId.get(aliases.get(p.id));for(const id of [p.father_id,p.mother_id]){const mapped=aliases.get(id);if(mapped&&mapped!==target.id&&!target.parents.includes(mapped))target.parents.push(mapped);}const spouse=aliases.get(p.spouse_id);if(spouse&&spouse!==target.id&&!target.partners.includes(spouse))target.partners.push(spouse);}
    for(const p of records){const target=byId.get(aliases.get(p.id));for(const [field,role] of [['father_id','fathers'],['mother_id','mothers']]){const id=aliases.get(p[field]);if(id&&id!==target.id&&!target[role].includes(id))target[role].push(id);}}
    for(const p of result)for(const id of p.partners){const partner=byId.get(id);if(partner&&!partner.partners.includes(p.id))partner.partners.push(p.id);}
    return result;
  }
  function connected(people,id){
    const edges=new Map(people.map(p=>[p.id,new Set()]));
    for(const p of people)for(const next of [...p.parents,...p.partners])if(edges.has(next)){edges.get(p.id).add(next);edges.get(next).add(p.id);}
    const found=new Set(),queue=[+id];while(queue.length){const current=queue.pop();if(found.has(current)||!edges.has(current))continue;found.add(current);for(const next of edges.get(current))queue.push(next);}return found;
  }
  function household(people,id){
    const person=people.find(p=>p.id===+id);if(!person)return new Set();
    const found=new Set([person.id,...person.parents]);let changed=true;
    while(changed){changed=false;for(const p of people){if(found.has(p.id)){for(const spouse of p.partners)if(!found.has(spouse)){found.add(spouse);changed=true;}}else if(p.parents.some(parent=>found.has(parent))){found.add(p.id);changed=true;}}}
    return found;
  }
  function levels(people){
    // Group spouses before assigning generations, including spouses without parents.
    const groups=new Map(people.map(p=>[p.id,p.id]));
    function find(id){let current=id;while(groups.get(current)!==current)current=groups.get(current);return current;}
    for(const p of people)for(const partner of p.partners)if(groups.has(partner))groups.set(find(partner),find(p.id));
    const parents=new Map();
    for(const p of people){const group=find(p.id);if(!parents.has(group))parents.set(group,new Set());for(const id of p.parents)if(groups.has(id)&&find(id)!==group)parents.get(group).add(find(id));}
    const memo=new Map();
    function visit(group,seen=new Set()){if(memo.has(group))return memo.get(group);if(seen.has(group))return 0;seen.add(group);const list=[...(parents.get(group)||[])];const n=list.length?1+Math.max(...list.map(id=>visit(id,new Set(seen)))):0;memo.set(group,n);return n;}
    return new Map(people.map(p=>[p.id,visit(find(p.id))]));
  }
  function oldestFirst(a,b){return (a.birth_date||'9999-99-99').localeCompare(b.birth_date||'9999-99-99')||a.id-b.id;}
  function siblingGroups(people){
    const groups=new Map();for(const p of people){if(!p.parents.length)continue;const key=[...p.parents].sort((a,b)=>a-b).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}for(const group of groups.values())group.sort(oldestFirst);return groups;
  }
  function childNumbers(people){const numbers=new Map();for(const group of siblingGroups(people).values())group.forEach((p,i)=>numbers.set(p.id,i+1));return numbers;}
  function orderRow(row,people,positions=new Map()){
    const ids=new Set(row.map(p=>p.id)),edges=new Map(row.map(p=>[p.id,new Set()]));
    const before=(a,b)=>{if(a!==b&&ids.has(a)&&ids.has(b))edges.get(a).add(b);};
    // Parent roles take priority over creation order, age and gender.
    for(const child of people)for(const father of child.fathers)for(const mother of child.mothers)before(father,mother);
    for(const siblings of siblingGroups(people).values())for(let i=1;i<siblings.length;i++)before(siblings[i-1].id,siblings[i].id);
    // Keep each parent's children together instead of interleaving cousins by birthday.
    const units=new Map(row.map(p=>[p.id,p.id]));
    function find(id){while(units.get(id)!==id)id=units.get(id);return id;}
    function join(a,b){if(ids.has(a)&&ids.has(b))units.set(find(b),find(a));}
    for(const siblings of siblingGroups(people).values())for(let i=1;i<siblings.length;i++)join(siblings[0].id,siblings[i].id);
    for(const p of row)for(const partner of p.partners)join(p.id,partner);
    for(const child of people)for(const father of child.fathers)for(const mother of child.mothers)join(father,mother);
    const blocks=new Map();for(const p of row){const key=find(p.id);if(!blocks.has(key))blocks.set(key,[]);blocks.get(key).push(p);}
    function anchor(block){const parents=[...new Set(block.flatMap(p=>p.parents))];const points=parents.filter(id=>positions.has(id)).map(id=>positions.get(id).x);return points.length?points.reduce((sum,x)=>sum+x,0)/points.length:parents.length?Math.min(...parents):Math.min(...block.map(p=>p.id));}
    const ordered=[];
    for(const block of [...blocks.values()].sort((a,b)=>anchor(a)-anchor(b)||oldestFirst(a[0],b[0]))){
      const pending=[...block].sort(oldestFirst);
      while(pending.length){let index=pending.findIndex(p=>!pending.some(q=>edges.get(q.id).has(p.id)));if(index<0)index=0;ordered.push(pending.splice(index,1)[0]);}
    }
    return ordered;
  }
  function generationWindow(people,rootId){
    const allLevels=levels(people);
    const start=Math.max(0,(allLevels.get(+rootId)||0)-1);
    const visible=people.filter(p=>allLevels.get(p.id)>=start&&allLevels.get(p.id)<start+3);
    return {people:visible,levels:new Map(visible.map(p=>[p.id,allLevels.get(p.id)-start]))};
  }
  function familyBranches(people,positions){
    const families=new Map();
    for(const child of people){
      const parents=child.parents.filter(id=>positions.has(id)).sort((a,b)=>a-b);
      if(!parents.length||!positions.has(child.id))continue;
      // Keep the complete parent identity as the key, even if a parent is off screen.
      const key=[...child.parents].sort((a,b)=>a-b).join(',');
      if(!families.has(key))families.set(key,{key,parents,children:[]});
      families.get(key).children.push(child.id);
    }
    const bands=new Map();
    for(const family of families.values()){
      family.top=Math.max(...family.parents.map(id=>positions.get(id).y+94));
      family.bottom=Math.min(...family.children.map(id=>positions.get(id).y));
      const band=`${family.top}:${family.bottom}`;
      if(!bands.has(band))bands.set(band,[]);bands.get(band).push(family);
    }
    const result=[];
    for(const band of bands.values())band.forEach((family,index)=>{
      // Each couple gets its own horizontal lane; cousin families never share a bus.
      const lane=family.top+(family.bottom-family.top)*(index+1)/(band.length+1);
      let parentPoints=family.parents.map(id=>({x:positions.get(id).x+100,y:positions.get(id).y+94}));
      let union='';
      if(parentPoints.length===2&&parentPoints[0].y===parentPoints[1].y){
        const [a,b]=parentPoints;
        const joined=people.find(p=>p.id===family.parents[0]).partners.includes(family.parents[1]);
        const y=a.y-47;
        if(!joined)union=`M${a.x},${y} H${b.x} `;
        parentPoints=[{x:(a.x+b.x)/2,y}];
      }
      const childPoints=family.children.map(id=>({x:positions.get(id).x+100,y:positions.get(id).y}));
      const xs=[...parentPoints,...childPoints].map(p=>p.x);
      const stems=[...parentPoints,...childPoints].map(p=>`M${p.x},${p.y} V${lane}`).join(' ');
      result.push({...family,lane,path:`${union}${stems} M${Math.min(...xs)},${lane} H${Math.max(...xs)}`});
    });
    return result;
  }
  function layout(people,generations,allPeople=people){
    const cardWidth=200,cardGap=40,step=cardWidth+cardGap;
    const positions=new Map(),rows=new Map();
    for(const p of people){const level=generations.get(p.id);if(!rows.has(level))rows.set(level,[]);rows.get(level).push(p);}
    const byId=new Map(people.map(p=>[p.id,p]));
    const familyKey=p=>p.parents.length?[...p.parents].sort((a,b)=>a-b).join(','):'';
    for(const [level,row] of [...rows].sort((a,b)=>a[0]-b[0])){
      const ordered=orderRow(row,allPeople,positions),blocks=[];
      for(const p of ordered){const key=familyKey(p)||p.partners.map(id=>byId.get(id)).filter(Boolean).map(familyKey).find(Boolean)||`alone:${p.id}`;const last=blocks.at(-1);if(last&&last.key===key)last.people.push(p);else blocks.push({key,people:[p]});}
      let x=0;for(const block of blocks){const width=Math.max(block.people.length*step,block.key.startsWith('alone:')?step:2*step);block.people.forEach((p,i)=>positions.set(p.id,{x:x+(width-block.people.length*step)/2+i*step,y:60+level*180}));x+=width+80;}
      rows.set(level,ordered);
    }
    // Work upwards: put each couple over its own children's span, rather than
    // centering every row independently (which made cousin branches intersect).
    for(const [level,row] of [...rows].sort((a,b)=>b[0]-a[0])){
      const units=new Map(row.map(p=>[p.id,p.id]));
      function find(id){while(units.get(id)!==id)id=units.get(id);return id;}
      function join(a,b){if(units.has(a)&&units.has(b))units.set(find(b),find(a));}
      for(const p of row)for(const partner of p.partners)join(p.id,partner);
      for(const child of people)for(const father of child.fathers)for(const mother of child.mothers)join(father,mother);
      const blocks=new Map();for(const p of row){const key=find(p.id);if(!blocks.has(key))blocks.set(key,[]);blocks.get(key).push(p);}
      let right=-Infinity;
      for(const block of blocks.values()){
        const ids=new Set(block.map(p=>p.id));
        const children=people.filter(p=>generations.get(p.id)>level&&p.parents.some(id=>ids.has(id)));
        const width=(block.length-1)*step+cardWidth;
        const centers=children.map(p=>positions.get(p.id).x+cardWidth/2);
        const desiredLeft=children.length?(Math.min(...centers)+Math.max(...centers))/2-width/2:Math.min(...block.map(p=>positions.get(p.id).x));
        // Pack every unit, including people without children, after its predecessor.
        const left=Math.max(desiredLeft,right+cardGap);
        block.forEach((p,i)=>positions.set(p.id,{x:left+i*step,y:60+level*180}));right=left+width;
      }
    }
    const minX=people.length?Math.min(...[...positions.values()].map(p=>p.x)):0;
    for(const pos of positions.values())pos.x+=50-minX;
    return {positions,width:Math.max(850,...[...positions.values()].map(p=>p.x+250)),height:Math.max(420,...[...positions.values()].map(p=>p.y+200))};
  }
  const api={merge,connected,household,levels,orderRow,childNumbers,generationWindow,familyBranches,layout};root.FamilyGraph=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
