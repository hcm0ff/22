/* app.js
   このファイルはUIの主要ロジックを実装します。
   - 単一HTML内の「ページ切り替え」ハッシュルーター（#top / #results / #map）
   - ヘッダーのキーワード検索（入力→結果ページへ遷移）
   - TOPページ：カルーセル（自動再生・前後ボタン・ドット・スワイプ対応）
   - TOPページ：カテゴリ・注目ワードから検索へ（結果ページに条件適用）
   - 結果ページ：左カラムのフォーム（キーワード／都道府県→市町村／カテゴリ）
   - 地図ページ：擬似地図（県庁所在地へ移動／円形範囲指定／範囲内ピン抽出）
   すべて素のHTML/CSS/JSで実装し、各処理に詳細コメントを付与しています。
*/

/* -------------------------------
   ユーティリティ：DOM取得ヘルパー
---------------------------------- */
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* -------------------------------
   疑似ルーター：ハッシュでページ切替
   - #top    → TOPページ
   - #results→ 結果ページ
   - #map    → 地図ページ
---------------------------------- */
const pages = {
  top: qs('#page-top'),
  results: qs('#page-results'),
  map: qs('#page-map'),
  detail: qs('#page-detail')
};

/* 現在ページを表示状態にする関数 */
function showPage(name) {
  // すべてのページを非表示にして、指定ページのみ表示
  Object.entries(pages).forEach(([key, el]) => {
    if (!el) return;
    el.hidden = key !== name;
  });
  // 見やすさのため、スクロールをトップへ
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ハッシュ変更時にページ切り替え */
function handleHashChange() {
  const hash = location.hash.replace('#', '') || 'top';
  if (hash in pages) {
    showPage(hash);
  } else if (hash.startsWith('detail:')) {
    // detail:<spotId> の形式で個別詳細を開く
    const parts = hash.split(':');
    const spotId = parts[1] || '';
    showDetail(spotId);
    showPage('detail');
  } else {
    showPage('top');
  }
}

/* 初期化：ハッシュ監視 */
window.addEventListener('hashchange', handleHashChange);

/* -------------------------------
   グローバル検索（ヘッダー）
   - 入力→結果ページへ遷移
---------------------------------- */
const globalSearchForm = qs('#globalSearchForm');
const globalSearchInput = qs('#globalSearchInput');

globalSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  // 入力値を結果ページに反映するため、クエリ状態を更新（簡易）
  const keyword = (globalSearchInput.value || '').trim();
  // ハッシュを結果ページに変更
  location.hash = '#results';
  // 結果ページのキーワード欄に同期
  setTimeout(() => {
    const resultsKeyword = qs('#resultsKeyword');
    if (resultsKeyword) {
      resultsKeyword.value = keyword;
    }
    // 実行：検索をトリガー
    runResultsSearch();
  }, 0);
});

/* 検索拡張ショートボタン（ヘッダー下） */
qs('#goRegionSearch').addEventListener('click', () => {
  // 結果ページへ遷移し、地域セクションにフォーカス
  location.hash = '#results';
  setTimeout(() => {
    qs('#prefSelect')?.focus();
  }, 0);
});
qs('#goMapSearch').addEventListener('click', () => {
  location.hash = '#map';
});

/* -------------------------------
   TOPページ：カルーセル
   - 自動再生（4s間隔）
   - 前後ボタン／ドット
   - スワイプ（pointer events）
---------------------------------- */
const carousel = qs('.carousel');
const track = qs('.carousel__track');
const slides = qsa('.carousel__slide');
const prevBtn = qs('.carousel__nav--prev');
const nextBtn = qs('.carousel__nav--next');
const dotsContainer = qs('.carousel__dots');

let currentIndex = 0;
let autoplayTimer = null;
const AUTOPLAY_MS = 4000;

/* ドット生成（スライド数に応じて） */
function createDots() {
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'carousel__dot';
    btn.setAttribute('aria-label', `スライド${i + 1}`);
    if (i === 0) btn.classList.add('is-active');
    btn.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(btn);
  });
}

/* スライド移動（インデックス指定） */
function goToSlide(index) {
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  currentIndex = index;
  const offset = -index * carousel.offsetWidth;
  track.style.transform = `translateX(${offset}px)`;
  // ドット同期
  const dots = qsa('.carousel__dot', dotsContainer);
  dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
}

/* 前後操作 */
function prevSlide() { goToSlide(currentIndex - 1); }
function nextSlide() { goToSlide(currentIndex + 1); }

/* 自動再生制御 */
function startAutoplay() {
  stopAutoplay();
  autoplayTimer = setInterval(nextSlide, AUTOPLAY_MS);
}
function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

/* スワイプ（pointer events） */
let pointerDown = false;
let startX = 0;

carousel.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  startX = e.clientX;
  carousel.setPointerCapture(e.pointerId);
  stopAutoplay();
});
carousel.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  const delta = e.clientX - startX;
  const offset = -currentIndex * carousel.offsetWidth + delta;
  track.style.transition = 'none';
  track.style.transform = `translateX(${offset}px)`;
});
function endSwipe(e) {
  if (!pointerDown) return;
  pointerDown = false;
  track.style.transition = '';
  const moved = e.clientX - startX;
  const threshold = carousel.offsetWidth * 0.18;
  if (moved > threshold) prevSlide();
  else if (moved < -threshold) nextSlide();
  else goToSlide(currentIndex);
  startAutoplay();
}
carousel.addEventListener('pointerup', endSwipe);
carousel.addEventListener('pointercancel', endSwipe);
carousel.addEventListener('pointerleave', endSwipe);

/* 初期化（ドット、イベント、リサイズ） */
function initCarousel() {
  if (!carousel) return;
  createDots();
  goToSlide(0);
  startAutoplay();
  prevBtn.addEventListener('click', () => { prevSlide(); startAutoplay(); });
  nextBtn.addEventListener('click', () => { nextSlide(); startAutoplay(); });
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  window.addEventListener('resize', () => goToSlide(currentIndex));
}

/* -------------------------------
   TOP：カテゴリ／注目ワード → 結果ページへ
---------------------------------- */
qsa('.category__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const category = btn.dataset.category;
    location.hash = '#results';
    setTimeout(() => {
      // カテゴリチェックON
      const boxes = qsa('input[name="category"]');
      boxes.forEach(b => b.checked = (b.value === category));
      // タイトルを更新し、検索実行
      runResultsSearch();
    }, 0);
  });
});
qsa('.keyword').forEach(btn => {
  btn.addEventListener('click', () => {
    const kw = btn.dataset.keyword;
    location.hash = '#results';
    setTimeout(() => {
      qs('#resultsKeyword').value = kw;
      runResultsSearch();
    }, 0);
  });
});

/* -------------------------------
   結果ページ：フォーム処理
   - 都道府県→市町村の階層選択
   - キーワードとカテゴリで結果生成（ダミーデータ）
---------------------------------- */
const resultsSearchForm = qs('#resultsSearchForm');
const resultsKeywordInput = qs('#resultsKeyword');
const prefSelect = qs('#prefSelect');
const citySelect = qs('#citySelect');
const resultsGrid = qs('#resultsGrid');
const resultsGoMap = qs('#resultsGoMap');
const resultsTitle = qs('#resultsTitle');
const resultsDesc = qs('#resultsDesc');

/* 仮の市町村データ（都道府県→市町村配列） */
const CITY_DATA = {
  '愛知県': ['名古屋市', '岡崎市', '豊橋市', '東海市'],
  '京都府': ['京都市', '宇治市', '亀岡市'],
  '青森県': ['青森市', '弘前市', '八戸市']
};

/* 都道府県選択で市町村を動的更新 */
prefSelect.addEventListener('change', () => {
  const pref = prefSelect.value;
  const cities = CITY_DATA[pref] || [];
  citySelect.innerHTML = '';
  if (cities.length) {
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '都道府県を選択してください';
    citySelect.appendChild(opt);
    citySelect.disabled = true;
  }
});

/* 結果ページの検索実行（ダミー：キーワード・地域・カテゴリを反映したカード生成） */
resultsSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  runResultsSearch();
});

/* 地図ページへショートカット */
resultsGoMap.addEventListener('click', () => {
  location.hash = '#map';
});

/* ダミーデータのスポット（簡易） */
const DUMMY_SPOTS = [
  { id: 's1', title: '藍染工房の体験', region: '愛知県/東海市', category: 'crafts', desc: '藍の深い青を自分の手で', color: '#2f5a40' },
  { id: 's2', title: '夏祭りの太鼓', region: '京都府/京都市', category: 'festival', desc: '響く太鼓と練り歩き', color: '#a83a2f' },
  { id: 's3', title: '郷土料理教室', region: '青森県/弘前市', category: 'food', desc: '季節に寄り添う味', color: '#3d4f66' },
  { id: 's4', title: '町家建築めぐり', region: '京都府/宇治市', category: 'architecture', desc: '古い町家の意匠を学ぶ', color: '#6a4a3b' },
  { id: 's5', title: '陶芸の里の工房訪問', region: '愛知県/岡崎市', category: 'experience', desc: '土と火の美を体験', color: '#865a3f' },
  { id: 's6', title: '伝承語りの夜', region: '青森県/青森市', category: 'folklore', desc: '語り部が継ぐ物語', color: '#385b71' }
];

/* 検索実行：条件に応じてフィルタしてカード表示 */
function runResultsSearch() {
  const kw = (resultsKeywordInput.value || '').trim();
  const pref = prefSelect.value || '';
  const city = (!citySelect.disabled && citySelect.value) ? citySelect.value : '';
  const selectedCats = qsa('input[name="category"]:checked').map(b => b.value);

  // 条件説明文の更新
  const parts = [];
  if (kw) parts.push(`キーワード：「${kw}」`);
  if (pref) parts.push(`都道府県：「${pref}」`);
  if (city) parts.push(`市町村：「${city}」`);
  if (selectedCats.length) parts.push(`カテゴリ：${selectedCats.join(' / ')}`);
  resultsTitle.textContent = '検索結果';
  resultsDesc.textContent = parts.length ? parts.join('、') : '条件に合致したスポットを表示します';

  // ダミーデータを条件でフィルタ
  let list = DUMMY_SPOTS.slice();
  if (kw) {
    const k = kw.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(k) ||
      s.desc.toLowerCase().includes(k) ||
      s.region.toLowerCase().includes(k)
    );
  }
  if (pref) {
    list = list.filter(s => s.region.startsWith(pref));
  }
  if (city) {
    list = list.filter(s => s.region.includes(`/${city}`));
  }
  if (selectedCats.length) {
    list = list.filter(s => selectedCats.includes(s.category));
  }

  // グリッドへカードDOMを描画
  resultsGrid.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('p');
    empty.textContent = '該当するスポットが見つかりませんでした。条件を調整してください。';
    resultsGrid.appendChild(empty);
    return;
  }
  list.forEach(s => {
    const article = document.createElement('article');
    article.className = 'card';
    // 仮の画像（色矩形）
    const img = document.createElement('img');
    img.className = 'card__image';
    img.alt = s.title;
    img.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='200'><rect width='100%25' height='100%25' fill='${encodeURIComponent(s.color)}'/></svg>`;
    const body = document.createElement('div');
    body.className = 'card__body';
    const title = document.createElement('h4');
    title.className = 'card__title'; title.textContent = s.title;
    const tag = document.createElement('p');
    tag.className = 'card__tag'; tag.textContent = `地域：${s.region}`;
    const desc = document.createElement('p');
    desc.className = 'card__desc'; desc.textContent = s.desc;
    const btn = document.createElement('button');
    btn.className = 'card__btn'; btn.textContent = '詳細を見る';
    btn.addEventListener('click', () => {
      // 詳細ページへ遷移（spot id をハッシュに含める）
      location.hash = `detail:${s.id}`;
    });

    body.append(title, tag, desc, btn);
    article.append(img, body);
    resultsGrid.appendChild(article);
  });
}

/* -------------------------------
   地図ページ：擬似地図と範囲指定
   - 県庁所在地に移動（擬似座標）
   - 範囲指定モード（円表示ON/OFF、ドラッグで位置、スクロールで半径）
   - 円内にあるスポットをピン＆カード表示（ダミー座標）
---------------------------------- */
const mapViewport = qs('#mapViewport');
const mapPrefSelect = qs('#mapPrefSelect');
const mapCenterBtn = qs('#mapCenterBtn');
const rangeModeBtn = qs('#rangeModeBtn');
const mapCircle = qs('#mapCircle');
const mapResultsGrid = qs('#mapResultsGrid');

/* 県庁所在地（擬似座標）：mapViewport内の座標系（0,0）〜（幅,高さ）
   実地の地図APIは使用せず、簡易な相対座標で表現。 */
const PREF_CAPITALS = {
  '愛知県': { name: '名古屋', x: 300, y: 180 },
  '京都府': { name: '京都', x: 520, y: 220 },
  '青森県': { name: '青森', x: 220, y: 120 }
};

/* スポットの擬似座標（DUMMY_SPOTSのidに紐づけ） */
const SPOT_COORDS = {
  s1: { x: 260, y: 200 }, // 東海市近辺（擬似）
  s2: { x: 520, y: 240 }, // 京都市（擬似）
  s3: { x: 200, y: 140 }, // 弘前（擬似）
  s4: { x: 500, y: 260 }, // 宇治（擬似）
  s5: { x: 320, y: 220 }, // 岡崎（擬似）
  s6: { x: 180, y: 120 }  // 青森市（擬似）
};

/* 現在のビュー中心（擬似パン） */
let viewOffset = { x: 0, y: 0 }; // 簡易的に未使用だが拡張で利用可能

/* 範囲指定モードの状態 */
let rangeMode = false;
/* 円の状態（中心座標と半径） */
let circleState = { x: 300, y: 200, r: 80 };

/* 地図にピンを描画する関数 */
function renderPins() {
  // 既存のピンを削除
  qsa('.map__pin', mapViewport).forEach(p => p.remove());
  // 全スポットを表示（絞り込みは円指定で判定）
  DUMMY_SPOTS.forEach(s => {
    const coord = SPOT_COORDS[s.id];
    if (!coord) return;
    const pin = document.createElement('div');
    pin.className = 'map__pin';
    pin.style.left = `${coord.x}px`;
    pin.style.top = `${coord.y}px`;
    pin.title = s.title;
    mapViewport.appendChild(pin);
  });
}

/* 円のDOMと状態を反映 */
function renderCircle() {
  mapCircle.style.left = `${circleState.x - circleState.r}px`;
  mapCircle.style.top = `${circleState.y - circleState.r}px`;
  mapCircle.style.width = `${circleState.r * 2}px`;
  mapCircle.style.height = `${circleState.r * 2}px`;
}

/* 円内スポットを抽出して下部グリッドに表示 */
function renderCircleResults() {
  mapResultsGrid.innerHTML = '';
  const inside = DUMMY_SPOTS.filter(s => {
    const c = SPOT_COORDS[s.id];
    if (!c) return false;
    const dx = c.x - circleState.x;
    const dy = c.y - circleState.y;
    return Math.sqrt(dx*dx + dy*dy) <= circleState.r;
  });
  if (!inside.length) {
    const p = document.createElement('p');
    p.textContent = '指定範囲内にスポットがありません。円の位置または半径を調整してください。';
    mapResultsGrid.appendChild(p);
    return;
  }
  inside.forEach(s => {
    const article = document.createElement('article');
    article.className = 'card';
    const img = document.createElement('img');
    img.className = 'card__image';
    img.alt = s.title;
    img.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='200'><rect width='100%25' height='100%25' fill='${encodeURIComponent(s.color)}'/></svg>`;
    const body = document.createElement('div');
    body.className = 'card__body';
    const title = document.createElement('h4');
    title.className = 'card__title'; title.textContent = s.title;
    const tag = document.createElement('p');
    tag.className = 'card__tag'; tag.textContent = `地域：${s.region}`;
    const desc = document.createElement('p');
    desc.className = 'card__desc'; desc.textContent = s.desc;
    const btn = document.createElement('button');
    btn.className = 'card__btn'; btn.textContent = '詳細を見る';
    btn.addEventListener('click', () => {
      location.hash = `detail:${s.id}`;
    });
    body.append(title, tag, desc, btn);
    article.append(img, body);
    mapResultsGrid.appendChild(article);
  });
}

/* モデルオーバーレイ要素 */
const modelOverlay = qs('#modelOverlay');
const modelOverlayClose = qs('#modelOverlayClose');
const overlayModelViewer = qs('#overlayModelViewer');

function openModelOverlay(modelSrc = 'models/craft.glb', iosSrc = 'models/craft.usdz') {
  if (!modelOverlay) return;
  if (overlayModelViewer) {
    overlayModelViewer.src = modelSrc;
    overlayModelViewer.setAttribute('ios-src', iosSrc);
  }
  modelOverlay.hidden = false;
  modelOverlay.setAttribute('aria-hidden', 'false');
  // フォーカス管理（閉じるボタンに移す）
  modelOverlayClose?.focus();
}
function closeModelOverlay() {
  if (!modelOverlay) return;
  modelOverlay.hidden = true;
  modelOverlay.setAttribute('aria-hidden', 'true');
  // モデルをアンロード（軽量化）
  if (overlayModelViewer) {
    overlayModelViewer.removeAttribute('src');
    overlayModelViewer.removeAttribute('ios-src');
  }
}

modelOverlayClose?.addEventListener('click', closeModelOverlay);
modelOverlay?.addEventListener('click', (e) => {
  // 背景クリックで閉じる（内部クリックは無視）
  if (e.target === modelOverlay) closeModelOverlay();
});

/* -------------------------------
   詳細ページ表示：指定スポットIDの情報を差し替え */
function showDetail(spotId) {
  const spot = DUMMY_SPOTS.find(s => s.id === spotId);
  const titleEl = qs('#detailTitle');
  const regionEl = qs('#detailRegion');
  const descEl = qs('#detailDesc');
  const imgEl = qs('#detailImage');
  const extraEl = qs('#detailExtra');
  const arArea = qs('#detailArArea');
  const modelViewer = qs('#detailModelViewer');
  const detailArBtn = qs('#detailArBtn');
  const mvArBtn = qs('#mvArBtn');

  if (!spot) {
    titleEl.textContent = '詳細情報がありません';
    regionEl.textContent = '';
    descEl.textContent = '選択されたスポットの詳細情報が見つかりません。';
    imgEl.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='960' height='420'><rect width='100%25' height='100%25' fill='%23e0e0e0'/></svg>`;
    extraEl.innerHTML = '';
    if (arArea) arArea.style.display = 'none';
    return;
  }
  titleEl.textContent = spot.title;
  regionEl.textContent = `地域：${spot.region}`;
  descEl.textContent = spot.desc + '（詳細ページサンプル）';
  imgEl.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='960' height='420'><rect width='100%25' height='100%25' fill='${encodeURIComponent(spot.color)}'/></svg>`;
  // サンプルの追加情報
  extraEl.innerHTML = `
    <li>営業時間：9:00〜17:00</li>
    <li>体験料金：2,000円〜（内容により変動）</li>
    <li>アクセス：最寄り駅からバスで約20分</li>
    <li>備考：要予約・休業日は施設に確認</li>
  `;

  // AR 表示：今回は "陶芸の里の工房訪問"（id s5）に対してモデルを表示する
  if (spot.id === 's5' && arArea && modelViewer) {
    // model-viewer の src を models 以下に設定（ファイルはプロジェクトに配置されている想定）
    modelViewer.src = 'models/craft.glb';
    modelViewer.setAttribute('ios-src', 'models/craft.usdz');
    arArea.style.display = 'block';

    // 外部ボタンで内部の ar-button をクリック
    if (detailArBtn && mvArBtn) {
      detailArBtn.onclick = () => {
        // 直接 model-viewer の AR ボタンを呼ぶ代わりに、オーバーレイでモデルを大きく表示してかつARボタンを有効化
        openModelOverlay('models/craft.glb', 'models/craft.usdz');
      };
    }
  } else if (arArea) {
    arArea.style.display = 'none';
  }
}

/* 戻るボタン処理：前のページへ戻る（ハッシュヒストリ） */
qs('#detailBackBtn').addEventListener('click', () => {
  // 可能なら前のハッシュに戻す。履歴がない場合はトップへ。
  if (history.length > 1) history.back();
  else location.hash = '#top';
});

/* 初期化：ページ・カルーセル・結果・地図 */
document.addEventListener('DOMContentLoaded', () => {
  // ハッシュルーター初期表示
  handleHashChange();

  // カルーセル初期化
  initCarousel();

  // 結果ページ：最初は空の状態で、フォーム変更で動作
  runResultsSearch();

  // 地図：初期ピン描画（擬似）
  renderPins();
  renderCircle(); // 円の初期位置
});
