'use strict';

const $ = (id) => document.getElementById(id);
const baseURL = new URL('../', location.href);
let data = null;

const sectionNames = {
  news: ['News', '新闻'],
  education: ['Education', '教育经历'],
  experience: ['Experience', '工作或研究经历'],
  projects: ['Projects', '项目'],
  service: ['Academic Service', '学术服务']
};
const uiSections = {
  news: 'News', education: '教育经历', experience: '工作或研究经历',
  projects: '项目', service: '学术服务'
};

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function lines(value) { return String(value ?? '').split(/\r?\n/).map(x => x.trim()).filter(Boolean); }
function textLines(value) { return Array.isArray(value) ? value.join('\n') : ''; }
function nonempty(value) { return typeof value === 'string' && value.trim() !== ''; }
function translate(item, key, language) {
  const translated = item?.[`${key}_zh`];
  return language === 'zh' && (Array.isArray(translated) ? translated.some(nonempty) : nonempty(translated)) ? translated : item?.[key];
}
function localPath(value) {
  if (typeof value !== 'string' || !/^assets\/(?:images|files)\/[A-Za-z0-9._/-]+$/.test(value)) return false;
  return !value.split('/').some(part => part === '.' || part === '..' || part === '');
}
function webOrLocal(value) {
  if (value === '') return true;
  if (!nonempty(value)) return false;
  if (localPath(value)) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}
function showErrors(errors) {
  const box = $('errors');
  if (!errors.length) { box.hidden = true; box.replaceChildren(); return; }
  const title = document.createElement('strong'); title.textContent = '请修正以下内容：';
  const list = document.createElement('ul');
  errors.forEach(message => { const li = document.createElement('li'); li.textContent = message; list.append(li); });
  box.replaceChildren(title, list); box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['配置应为 JSON 对象。'];
  if (input.schema_version !== 1) errors.push('schema_version 必须为 1。');
  if (!input.site || !['en', 'zh'].includes(input.site.language)) errors.push('站点默认语言必须为 en 或 zh。');
  if (typeof input.site?.url !== 'string' || (input.site.url && (!webOrLocal(input.site.url) || localPath(input.site.url) || !/^https?:\/\//i.test(input.site.url)))) errors.push('网站 URL 必须是完整的 http(s) 地址。');
  const p = input.profile;
  if (!p || !nonempty(p.name)) errors.push('英文姓名不能为空。');
  if (p) {
    for (const key of ['name', 'name_zh', 'affiliation', 'affiliation_zh', 'position', 'position_zh', 'email', 'photo', 'photo_alt', 'scholar', 'github', 'cv']) if (p[key] !== undefined && typeof p[key] !== 'string') errors.push(`profile.${key} 必须是文字。`);
    for (const key of ['scholar', 'github', 'cv']) if (!webOrLocal(p[key] ?? '')) errors.push(`${key} 链接无效，只能用 http(s) 或 assets/ 下的路径。`);
    if (nonempty(p.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push('邮箱格式无效。');
    if (p.photo && (!localPath(p.photo) || !p.photo.startsWith('assets/images/'))) errors.push('照片路径应为 assets/images/ 下的相对路径。');
    if (p.photo && !nonempty(p.photo_alt)) errors.push('填写照片时也要填写照片替代文本。');
    if (p.cv && localPath(p.cv) && (!p.cv.startsWith('assets/files/') || !/\.pdf$/i.test(p.cv))) errors.push('本地 CV 应为 assets/files/ 下的 PDF。');
    for (const key of ['bio', 'research_interests', 'bio_zh', 'research_interests_zh'])
      if (p[key] !== undefined && (!Array.isArray(p[key]) || !p[key].every(x => typeof x === 'string'))) errors.push(`${key} 必须是文字数组。`);
  }
  if (!Array.isArray(input.publications)) errors.push('publications 必须是数组。');
  else {
    const ids = new Set();
    input.publications.forEach((pub, i) => {
      const prefix = `第 ${i + 1} 篇论文`;
      if (!pub || typeof pub !== 'object') { errors.push(`${prefix} 格式无效。`); return; }
      if (!nonempty(pub.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pub.id)) errors.push(`${prefix} 的 ID 应由小写英文、数字和连字符组成。`);
      if (ids.has(pub.id)) errors.push(`${prefix} 的 ID 与其他论文重复。`); ids.add(pub.id);
      if (!nonempty(pub.title)) errors.push(`${prefix} 缺少标题。`);
      for (const key of ['title_zh', 'venue', 'status', 'thumbnail', 'thumbnail_alt', 'summary', 'summary_zh']) if (pub[key] !== undefined && typeof pub[key] !== 'string') errors.push(`${prefix}.${key} 必须是文字。`);
      if (!Array.isArray(pub.authors) || !pub.authors.length || !pub.authors.every(nonempty)) errors.push(`${prefix} 至少需要一位作者，作者行不能空白。`);
      if (!Number.isInteger(pub.year) || pub.year < 1000 || pub.year > 3000) errors.push(`${prefix} 年份应为四位整数。`);
      if (typeof pub.selected !== 'boolean') errors.push(`${prefix} 的“精选”必须明确勾选或取消。`);
      if (pub.thumbnail && (!localPath(pub.thumbnail) || !pub.thumbnail.startsWith('assets/images/'))) errors.push(`${prefix} 的配图路径应在 assets/images/ 下。`);
      if (pub.thumbnail && !nonempty(pub.thumbnail_alt)) errors.push(`${prefix} 的配图需要替代文本。`);
      if (!pub.links || typeof pub.links !== 'object' || Array.isArray(pub.links)) errors.push(`${prefix}.links 必须是对象。`);
      for (const key of ['paper', 'scholar', 'code', 'project']) if (!webOrLocal(pub.links?.[key] ?? '')) errors.push(`${prefix} 的 ${key} 链接无效。`);
    });
  }
  for (const [key, label] of Object.entries(uiSections)) {
    if (!Array.isArray(input[key])) { errors.push(`${label} 必须是数组。`); continue; }
    input[key].forEach((item, i) => {
      if (!item || typeof item !== 'object') { errors.push(`${label} 第 ${i + 1} 条格式无效。`); return; }
      const textKeys = key === 'news' ? ['date', 'title', 'title_zh', 'description', 'description_zh', 'url'] : ['period', 'title', 'title_zh', 'organization', 'organization_zh', 'description', 'description_zh', 'url'];
      for (const field of textKeys) if (item[field] !== undefined && typeof item[field] !== 'string') errors.push(`${label} 第 ${i + 1} 条的 ${field} 必须是文字。`);
      if (!nonempty(item.title) && Object.values(item).some(nonempty)) errors.push(`${label} 第 ${i + 1} 条填写了内容但缺少标题。`);
      if (!webOrLocal(item.url ?? '')) errors.push(`${label} 第 ${i + 1} 条链接无效。`);
    });
  }
  return errors;
}
function markChanged() { $('editor-state').textContent = '当前修改尚未发布；请预览并导出配置。'; showErrors([]); }
function makeField(label, value, setter, opts = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = `field${opts.full ? ' full' : ''}${opts.type === 'checkbox' ? ' checkbox' : ''}`;
  const caption = document.createElement('span'); caption.textContent = label;
  let control;
  if (opts.type === 'textarea' || opts.type === 'lines') { control = document.createElement('textarea'); control.value = opts.type === 'lines' ? textLines(value) : (value ?? ''); }
  else if (opts.type === 'select') {
    control = document.createElement('select');
    for (const [optionValue, optionLabel] of opts.options) { const option = document.createElement('option'); option.value = optionValue; option.textContent = optionLabel; control.append(option); }
    control.value = value ?? '';
  } else {
    control = document.createElement('input'); control.type = opts.type || 'text';
    if (opts.type === 'checkbox') control.checked = Boolean(value); else control.value = value ?? '';
  }
  if (opts.placeholder) control.placeholder = opts.placeholder;
  control.addEventListener(opts.type === 'checkbox' || opts.type === 'select' ? 'change' : 'input', () => {
    let next = opts.type === 'checkbox' ? control.checked : opts.type === 'lines' ? lines(control.value) : opts.type === 'number' ? (control.value === '' ? '' : Number(control.value)) : control.value;
    setter(next); markChanged();
  });
  wrapper.append(caption, control);
  if (opts.hint) { const hint = document.createElement('small'); hint.textContent = opts.hint; wrapper.append(hint); }
  return wrapper;
}
function addFields(parent, object, specs) {
  specs.forEach(([key, label, opts = {}]) => parent.append(makeField(label, object[key], value => { object[key] = value; }, opts)));
}
function renderSite() {
  const parent = $('site-fields'); parent.replaceChildren();
  addFields(parent, data.site, [
    ['language', '默认语言', {type:'select', options:[['en','English'], ['zh','中文']], hint:'决定主页根路径的语言；另一种语言仍可切换。'}],
    ['url', '网站公开 URL', {placeholder:'https://用户名.github.io/', hint:'确认实际网址后再填写。用于 canonical 和 sitemap；留空时不会生成。'}]
  ]);
}
function renderProfile() {
  const parent = $('profile-fields'); parent.replaceChildren();
  addFields(parent, data.profile, [
    ['name','英文姓名'], ['name_zh','中文姓名'],
    ['affiliation','单位（英文）'], ['affiliation_zh','单位（中文）'],
    ['position','身份或职位（英文）'], ['position_zh','身份或职位（中文）'],
    ['bio','个人简介（英文）',{type:'lines',full:true,hint:'一行一段，无需写 HTML。'}],
    ['bio_zh','个人简介（中文）',{type:'lines',full:true}],
    ['research_interests','研究方向（英文）',{type:'lines',full:true,hint:'一行一项。'}],
    ['research_interests_zh','研究方向（中文）',{type:'lines',full:true}],
    ['scholar','Google Scholar',{type:'url'}], ['email','邮箱',{type:'email'}],
    ['github','GitHub',{type:'url'}], ['cv','CV',{hint:'相对路径示例：assets/files/cv.pdf'}],
    ['photo','照片路径',{hint:'相对路径示例：assets/images/profile.jpg'}],
    ['photo_alt','照片替代文本',{hint:'有照片时必填，例如“Haoyu Wang portrait”。'}]
  ]);
}
function cardActions(container, list, index, rerender, label) {
  const actions = document.createElement('div'); actions.className = 'item-actions';
  for (const [text, move] of [['上移', -1], ['下移', 1]]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.disabled = index + move < 0 || index + move >= list.length;
    button.addEventListener('click', () => { [list[index], list[index + move]] = [list[index + move], list[index]]; rerender(); markChanged(); });
    actions.append(button);
  }
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = '删除';
  remove.addEventListener('click', () => { if (confirm(`确定删除这条${label}吗？此操作只影响当前浏览器中的副本。`)) { list.splice(index, 1); rerender(); markChanged(); } });
  actions.append(remove); container.append(actions);
}
function renderPublications() {
  const parent = $('publications-list'); parent.replaceChildren();
  data.publications.forEach((pub, index) => {
    const card = document.createElement('div'); card.className = 'item-card';
    const details = document.createElement('details'); if (index === 0) details.open = true;
    const summary = document.createElement('summary'); summary.textContent = `${index + 1}. ${pub.title || '未命名论文'}`;
    const grid = document.createElement('div'); grid.className = 'field-grid';
    addFields(grid, pub, [
      ['id','论文 ID',{hint:'英文小写、数字、连字符；例如 my-new-paper。'}],
      ['selected','进入精选论文',{type:'checkbox'}],
      ['title','标题',{full:true}], ['title_zh','中文标题（可选）',{full:true}],
      ['authors','作者',{type:'lines',full:true,hint:'一行一位，保持论文署名顺序。'}],
      ['venue','会议或期刊'], ['year','年份',{type:'number'}], ['status','状态'],
      ['summary','摘要或简述（英文）',{type:'textarea',full:true}],
      ['summary_zh','摘要或简述（中文）',{type:'textarea',full:true}],
      ['thumbnail','配图路径',{hint:'例如 assets/images/paper-figure.png'}],
      ['thumbnail_alt','配图替代文本']
    ]);
    const linkHeading = document.createElement('h4'); linkHeading.textContent = '论文资源'; linkHeading.style.gridColumn = '1 / -1'; linkHeading.style.margin = '4px 0 0'; grid.append(linkHeading);
    addFields(grid, pub.links, [
      ['paper','Paper 链接',{hint:'例如 https://arxiv.org/abs/…'}],
      ['scholar','Google Scholar 条目'], ['code','Code 链接'], ['project','Project 链接']
    ]);
    details.append(summary, grid); card.append(details); cardActions(card, data.publications, index, renderPublications, '论文'); parent.append(card);
    grid.querySelectorAll('input,textarea').forEach(control => control.addEventListener('input', () => { summary.textContent = `${index + 1}. ${pub.title || '未命名论文'}`; }));
  });
}
function blankEntry(key) { return key === 'news' ? {date:'',title:'',title_zh:'',description:'',description_zh:'',url:''} : {period:'',title:'',title_zh:'',organization:'',organization_zh:'',description:'',description_zh:'',url:''}; }
function renderOther() {
  const parent = $('other-sections'); parent.replaceChildren();
  for (const [key, label] of Object.entries(uiSections)) {
    const section = document.createElement('section'); section.className = 'subsection';
    const head = document.createElement('div'); head.className = 'section-head';
    const heading = document.createElement('h3'); heading.textContent = label;
    const add = document.createElement('button'); add.type = 'button'; add.textContent = `新增${label}`;
    add.addEventListener('click', () => { data[key].push(blankEntry(key)); renderOther(); markChanged(); });
    head.append(heading, add); section.append(head);
    const list = document.createElement('div'); list.className = 'card-list';
    data[key].forEach((entry, index) => {
      const card = document.createElement('div'); card.className = 'item-card';
      const details = document.createElement('details'); details.open = true;
      const summary = document.createElement('summary'); summary.textContent = `${index + 1}. ${entry.title || '未命名条目'}`;
      const grid = document.createElement('div'); grid.className = 'field-grid';
      const specs = key === 'news' ? [
        ['date','日期',{hint:'可留空；例如 2027 或 2027-01。'}], ['title','标题'],
        ['title_zh','中文标题'], ['url','链接'],
        ['description','说明（英文）',{type:'textarea',full:true}],
        ['description_zh','说明（中文）',{type:'textarea',full:true}]
      ] : [
        ['period','时间',{hint:'例如 2024–2026；可留空。'}], ['title','标题'],
        ['title_zh','中文标题'], ['organization','机构（英文）'],
        ['organization_zh','机构（中文）'], ['url','链接'],
        ['description','说明（英文）',{type:'textarea',full:true}],
        ['description_zh','说明（中文）',{type:'textarea',full:true}]
      ];
      addFields(grid, entry, specs); details.append(summary, grid); card.append(details);
      cardActions(card, data[key], index, renderOther, label); list.append(card);
      grid.querySelectorAll('input,textarea').forEach(control => control.addEventListener('input', () => { summary.textContent = `${index + 1}. ${entry.title || '未命名条目'}`; }));
    });
    section.append(list); parent.append(section);
  }
}
function renderForms() { renderSite(); renderProfile(); renderPublications(); renderOther(); $('preview-language').value = data.site.language; }

function pathURL(path) { return localPath(path) ? escapeHTML(path) : escapeHTML(path); }
function externalAttrs(path) { return /^https?:\/\//i.test(path) ? ' target="_blank" rel="noopener noreferrer"' : ''; }
function anchor(path, label) { return `<a href="${pathURL(path)}"${externalAttrs(path)}>${escapeHTML(label)}</a>`; }
function renderPreview(language) {
  const p = data.profile, zh = language === 'zh', rootLanguage = data.site.language;
  const name = translate(p, 'name', language) || p.name;
  const labels = zh ? {home:'首页',pubNav:'论文',pub:'精选论文',news:'动态',education:'教育经历',experience:'工作或研究经历',projects:'项目',service:'学术服务',interest:'研究方向',more:'链接'} : {home:'Home',pubNav:'Publications',pub:'Selected Publications',news:'News',education:'Education',experience:'Experience',projects:'Projects',service:'Academic Service',interest:'Research interests',more:'Link'};
  const pubs = data.publications.filter(x => x.selected);
  const visible = Object.keys(sectionNames).filter(key => data[key].some(x => nonempty(x.title)));
  const nav = [`<a href="#home">${labels.home}</a>`, ...(pubs.length ? [`<a href="#publications">${labels.pubNav}</a>`] : []), ...visible.map(key => `<a href="#${key}">${labels[key]}</a>`)].join('');
  const langLinks = `<span class="language-links"><a href="#" data-preview-lang="en"${!zh ? ' aria-current="page"' : ''}>EN</a><a href="#" data-preview-lang="zh"${zh ? ' aria-current="page"' : ''}>中文</a></span>`;
  const metadata = [translate(p,'position',language), translate(p,'affiliation',language)].filter(nonempty).map(escapeHTML).join(' · ');
  const profileLinks = [['scholar','Google Scholar'],['email','Email'],['github','GitHub'],['cv','CV']].filter(([key]) => nonempty(p[key])).map(([key,label]) => key === 'email' ? anchor(`mailto:${p.email}`,label) : anchor(p[key],label)).join('');
  const bio = (translate(p,'bio',language) || []).filter(nonempty).map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join('');
  const interests = (translate(p,'research_interests',language) || []).filter(nonempty).map(escapeHTML).join(' · ');
  const photo = p.photo ? `<img class="profile-photo" src="${pathURL(p.photo)}" alt="${escapeHTML(p.photo_alt)}" data-optional-image>` : '';
  const profile = `<section class="profile${photo ? ' with-photo' : ''}" id="home"><div class="profile-body"><h1 class="profile-name">${escapeHTML(name)}</h1>${metadata ? `<p class="profile-meta">${metadata}</p>` : ''}${profileLinks ? `<div class="profile-links">${profileLinks}</div>` : ''}${bio ? `<div class="bio">${bio}</div>` : ''}${interests ? `<div class="interests"><span class="interests-label">${labels.interest}: </span><span class="interests-list">${interests}</span></div>` : ''}</div>${photo}</section>`;
  const papers = pubs.map(pub => {
    const title = escapeHTML(translate(pub,'title',language));
    const titleHTML = pub.links?.paper ? anchor(pub.links.paper, translate(pub,'title',language)) : title;
    const authors = pub.authors.map(author => author === p.name || (p.name_zh && author === p.name_zh) ? `<strong>${escapeHTML(author)}</strong>` : escapeHTML(author)).join(', ');
    const venue = [pub.venue, pub.year].filter(Boolean).map(escapeHTML).join(' ');
    const status = [venue, pub.status && escapeHTML(pub.status)].filter(Boolean).join(' · ');
    const resourceLabels = {paper:'Paper (arXiv)',scholar:'Google Scholar',code:'Code',project:'Project'};
    const resources = Object.entries(resourceLabels).filter(([key]) => nonempty(pub.links?.[key])).map(([key,label]) => anchor(pub.links[key],label)).join('');
    const image = pub.thumbnail ? `<img class="publication-image" src="${pathURL(pub.thumbnail)}" alt="${escapeHTML(pub.thumbnail_alt)}" data-optional-image>` : '';
    return `<li class="publication${image ? ' has-image' : ''}">${image}<div class="publication-body"><h3 class="publication-title">${titleHTML}</h3><p class="publication-authors">${authors}</p>${status ? `<p class="publication-venue">${status}</p>` : ''}${translate(pub,'summary',language) ? `<p class="publication-summary">${escapeHTML(translate(pub,'summary',language))}</p>` : ''}${resources ? `<div class="publication-links">${resources}</div>` : ''}</div></li>`;
  }).join('');
  const pubSection = papers ? `<section class="section" id="publications"><h2 class="section-title">${labels.pub}</h2><ol class="publication-list">${papers}</ol></section>` : '';
  const otherSections = visible.map(key => {
    const items = data[key].filter(x => nonempty(x.title)).map(item => {
      const title = translate(item,'title',language), url = item.url;
      const time = key === 'news' ? item.date : item.period;
      const organization = key !== 'news' ? translate(item,'organization',language) : '';
      const description = translate(item,'description',language);
      return `<li class="entry">${time ? `<div class="entry-date">${escapeHTML(time)}</div>` : ''}<h3 class="entry-title">${url ? anchor(url,title) : escapeHTML(title)}</h3>${organization ? `<p class="entry-org">${escapeHTML(organization)}</p>` : ''}${description ? `<p class="entry-description">${escapeHTML(description)}</p>` : ''}</li>`;
    }).join('');
    return `<section class="section" id="${key}"><h2 class="section-title">${labels[key]}</h2><ol class="entry-list">${items}</ol></section>`;
  }).join('');
  const html = `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${escapeHTML(baseURL.href)}"><link rel="stylesheet" href="assets/css/site.css"><title>${escapeHTML(name)}</title></head><body><header class="site-header"><div class="header-inner"><a class="brand" href="#home">${escapeHTML(name)}</a><nav class="nav-links" aria-label="Primary">${nav}</nav>${langLinks}</div></header><main class="page-shell">${profile}${pubSection}${otherSections}</main><footer class="site-footer"><div class="footer-inner">© ${escapeHTML(name)}</div></footer><script src="assets/js/site.js"><\/script></body></html>`;
  $('preview-frame').srcdoc = html;
  $('preview-frame').addEventListener('load', () => {
    const frame = $('preview-frame');
    frame.style.height = `${Math.max(650, frame.contentDocument.documentElement.scrollHeight + 2)}px`;
    frame.contentDocument.querySelectorAll('[data-preview-lang]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); $('preview-language').value = link.dataset.previewLang; renderPreview(link.dataset.previewLang); }));
  }, {once:true});
  checkAssets();
}
async function checkAssets() {
  const paths = new Set();
  const p = data.profile;
  [p.photo,p.cv].forEach(x => { if (localPath(x)) paths.add(x); });
  for (const pub of data.publications) { [pub.thumbnail,...Object.values(pub.links || {})].forEach(x => { if (localPath(x)) paths.add(x); }); }
  for (const key of Object.keys(uiSections)) for (const entry of data[key]) if (localPath(entry.url)) paths.add(entry.url);
  const box = $('asset-check');
  if (!paths.size) { box.textContent = '当前没有引用本地图片或文件。'; return; }
  box.textContent = '正在检查引用的本地文件…';
  const checks = await Promise.all([...paths].map(async path => {
    try { const response = await fetch(new URL(path, baseURL), {method:'HEAD', cache:'no-store'}); return `${response.ok ? '✓' : '缺失'} ${path}${response.ok ? '' : ' — 请先上传至仓库'}`; }
    catch { return `无法检查 ${path} — 请确认文件已上传至仓库`; }
  }));
  const list = document.createElement('ul'); checks.forEach(value => { const li = document.createElement('li'); li.textContent = value; list.append(li); }); box.replaceChildren(list);
}
function doPreview() {
  const errors = validate(data); showErrors(errors); if (errors.length) return;
  renderPreview($('preview-language').value);
  $('preview-section').scrollIntoView({behavior:'smooth'});
}
function doExport() {
  const errors = validate(data); showErrors(errors); if (errors.length) return;
  const file = new Blob([JSON.stringify(data, null, 2) + '\n'], {type:'application/json;charset=utf-8'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = 'site.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('editor-state').textContent = '配置已导出；当前修改尚未发布。请在 GitHub 替换 data/site.json 并提交。';
}
async function doImport(file) {
  try {
    const imported = JSON.parse(await file.text()); const errors = validate(imported); showErrors(errors); if (errors.length) return;
    data = imported; renderForms(); $('editor-state').textContent = '配置已导入到当前浏览器；尚未发布。';
  } catch (error) { showErrors([`导入失败：${error.message}`]); }
}

$('preview-button').addEventListener('click', doPreview);
$('export-button').addEventListener('click', doExport);
$('import-button').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) doImport(file); event.target.value = ''; });
$('preview-language').addEventListener('change', () => { if (data) doPreview(); });
$('add-publication').addEventListener('click', () => {
  data.publications.push({id:`new-publication-${Date.now()}`,title:'',title_zh:'',authors:[],venue:'',year:'',status:'',selected:true,thumbnail:'',thumbnail_alt:'',summary:'',summary_zh:'',links:{paper:'',scholar:'',code:'',project:''}});
  renderPublications(); markChanged();
});

fetch(new URL('data/site.json', baseURL), {cache:'no-store'})
  .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then(current => { const errors = validate(current); if (errors.length) throw new Error(errors.join('；')); data = current; renderForms(); $('editor-state').textContent = '已加载当前已发布的数据；修改尚未发布。'; })
  .catch(error => { $('editor-state').textContent = '加载失败。请通过网站地址或 python3 scripts/serve.py 打开维护页。'; showErrors([error.message]); });
