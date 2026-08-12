let data=[];
const $=id=>document.getElementById(id);
document.addEventListener("DOMContentLoaded",()=>{ $("search").addEventListener("click",search); load(); });
async function load(){
 try{
  const r=await fetch("../data/winner_list.csv",{cache:"no-store"});
  if(!r.ok) throw new Error(`CSV読み込み失敗（HTTP ${r.status}）`);
  const t=await r.text(); data=parseCSV(t);
  if(!data.length) throw new Error("入賞者データが空です。");
  $("lastUpdated").textContent="最終更新日："+(data[0]["日付"]||"");
  $("status").className="status ok"; $("status").textContent=`データ読み込み完了：${data.length.toLocaleString()}件`;
 }catch(e){$("status").className="status error";$("status").textContent="データを読み込めませんでした："+e.message;}
}
function parseCSV(text){
 const rows=[]; let row=[], cell="", quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
  if(c==='"'&&quoted&&n==='"'){cell+='"';i++;continue}
  if(c==='"'){quoted=!quoted;continue}
  if(c===","&&!quoted){row.push(cell);cell="";continue}
  if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(cell);cell="";if(row.some(x=>x.trim()!==""))rows.push(row);row=[];continue}
  cell+=c;
 }
 if(cell!==""||row.length){row.push(cell);rows.push(row)}
 const headers=rows.shift().map(x=>x.trim());
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??"").trim()])));
}
function search(){
 const surname=$("surname").value.trim(),given=$("given").value.trim(),team=$("team").value.trim();
 if(!surname&&!given&&!team){$("status").className="status error";$("status").textContent="少なくとも1つ以上の検索条件を入力してください。";return}
 const result=data.filter(x=>(x["名前"]||"").includes(surname)&&(x["名前"]||"").includes(given)&&(x["チーム名"]||"").includes(team));
 $("results").classList.remove("hidden");$("total").textContent=result.length+"回";
 const groups=["A","B","C","D"], heads=["クラス","1部優勝","1部準優勝","1部3位","2部優勝","2部準優勝","2部3位"];
 let h="<table><thead><tr>"+heads.map(x=>`<th>${esc(x)}</th>`).join("")+"</tr></thead><tbody>";
 for(const g of groups){h+="<tr><td>"+g+"グループ</td>";for(let part=1;part<=2;part++)for(let rank=1;rank<=3;rank++)h+=`<td>${result.filter(x=>(x["クラス"]||"").toUpperCase().includes(g)&&String(x["部"])===String(part)&&String(x["位"])===String(rank)).length}</td>`;h+="</tr>"}h+="</tbody></table>";$("summary").innerHTML=h;
 const cols=["日付","名前","チーム名","クラス","部","位"];$("detail").innerHTML=result.length?table(result,cols):"<p>該当するデータはありません。</p>";
}
function table(rows,cols){return "<table><thead><tr>"+cols.map(c=>`<th>${esc(c)}</th>`).join("")+"</tr></thead><tbody>"+rows.map(r=>"<tr>"+cols.map(c=>`<td>${esc(r[c]||"")}</td>`).join("")+"</tr>").join("")+"</tbody></table>"}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}