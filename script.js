import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = { apiKey: 'AIzaSyDPSJ8xGO9_EiIqj9tJGzYV0yU9kFWtmyI', authDomain: 'bada-market-a0025.firebaseapp.com', projectId: 'bada-market-a0025', storageBucket: 'bada-market-a0025.firebasestorage.app', messagingSenderId: '560692888958', appId: '1:560692888958:web:46ea3303e6fe034ad09f2f' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const marketRef = doc(db, 'market', 'state');
let marketState = { products: [], reservations: [] };
let signedInUser = null;
let authMode = 'login';

const sampleArrival = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
const initialProducts = [
  { id: 'seed-1', boat: '은빛바다호', name: '꽃게', type: '일반', price: 18000, quantity: 35, reserved: 8, arrival: sampleArrival, status: '입항 예정' },
  { id: 'seed-2', boat: '푸른파도호', name: '못난이 광어', type: '못난이', price: 12000, quantity: 20, reserved: 5, arrival: sampleArrival, status: '입항 예정' }
];

function getProducts() { return (marketState.products || []).filter(p => new Date(p.arrival).getTime() > Date.now()); }
function getReservations() { return marketState.reservations || []; }
function persistMarket() { setDoc(marketRef, marketState).catch(() => showToast('공유 데이터 저장에 실패했습니다. 인터넷 연결을 확인해주세요.')); }
function saveProducts(products) { marketState.products = products; persistMarket(); }
function saveReservations(reservations) { marketState.reservations = reservations; persistMarket(); }
async function initializeFirebase() {
  const existing = await getDoc(marketRef);
  if (!existing.exists()) { marketState = { products: initialProducts, reservations: [] }; await setDoc(marketRef, marketState); }
  onSnapshot(marketRef, snapshot => { if (!snapshot.exists()) return; marketState = snapshot.data(); renderAll(); }, () => showToast('Firebase 연결에 실패했습니다.'));
}
function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
function remaining(p) { return Math.max(0, Number(p.quantity) - Number(p.reserved || 0)); }
function dateText(value) { const d = new Date(value); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function currentUser() { return signedInUser?.displayName || signedInUser?.email?.split('@')[0] || ''; }
function currentUserId() { return signedInUser?.uid || ''; }
function isMine(item) { return item.ownerId ? item.ownerId === currentUserId() : item.owner === currentUser(); }
function isMyReservation(item) { return item.userId ? item.userId === currentUserId() : item.user === currentUser(); }

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  document.getElementById('loginTab').classList.toggle('active', !signup);
  document.getElementById('signupTab').classList.toggle('active', signup);
  document.getElementById('signupNickname').classList.toggle('hidden', !signup);
  document.getElementById('signupConfirm').classList.toggle('hidden', !signup);
  document.getElementById('nickname').required = signup;
  document.getElementById('passwordConfirm').required = signup;
  document.getElementById('password').autocomplete = signup ? 'new-password' : 'current-password';
  document.getElementById('authSubmit').textContent = signup ? '회원가입' : '로그인';
  document.getElementById('authGuide').textContent = signup ? '이메일 계정과 비밀번호로 가입하면 다음부터 로그인할 수 있어요.' : '가입한 이메일과 비밀번호로 로그인하세요.';
}
function authError(error) {
  const messages = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인으로 들어가주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/invalid-email': '올바른 이메일 주소를 입력해주세요.',
    'auth/weak-password': '비밀번호는 6자리 이상이어야 합니다.',
    'auth/too-many-requests': '시도가 많습니다. 잠시 후 다시 시도해주세요.'
  };
  return messages[error.code] || '계정 처리 중 문제가 생겼습니다. 다시 시도해주세요.';
}
async function submitAuth(event) {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const button = document.getElementById('authSubmit');
  if (authMode === 'signup') {
    const nickname = document.getElementById('nickname').value.trim();
    const confirm = document.getElementById('passwordConfirm').value;
    if (!nickname) return showToast('닉네임을 입력해주세요.');
    if (password !== confirm) return showToast('비밀번호 확인이 일치하지 않습니다.');
  }
  button.disabled = true;
  try {
    if (authMode === 'signup') {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: document.getElementById('nickname').value.trim() });
      signedInUser = auth.currentUser;
      showToast('회원가입이 완료되었습니다. 환영합니다!');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('로그인되었습니다.');
    }
    document.getElementById('authForm').reset();
  } catch (error) { showToast(authError(error)); }
  finally { button.disabled = false; }
}
async function logout() { await signOut(auth); goHome(); showToast('로그아웃했습니다.'); }
function updateUserName() { document.querySelectorAll('.user-name').forEach(el => el.textContent = currentUser()); }
function startAs(role) { if (!signedInUser) { document.getElementById('email').focus(); return showToast('로그인 후 이용할 수 있습니다.'); } document.getElementById('roleScreen').classList.add('hidden'); document.getElementById(role + 'Screen').classList.remove('hidden'); renderAll(); }
function goHome() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); document.getElementById('roleScreen').classList.remove('hidden'); }
function showToast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
async function previewPhoto(event) { const file = event.target.files[0], preview = document.getElementById('photoPreview'); if (!file) return preview.classList.add('hidden'); if (file.size > 500 * 1024) { event.target.value = ''; preview.classList.add('hidden'); return showToast('사진은 500KB 이하로 선택해주세요.'); } preview.src = await fileToDataUrl(file); preview.classList.remove('hidden'); }
function toggleProductForm() { const form = document.getElementById('productForm'); form.classList.toggle('hidden'); if (!form.classList.contains('hidden') && !form.dataset.editing) { form.reset(); document.getElementById('productSubmit').textContent = '판매 정보 등록하기'; } }
function reservationProduct(r) { return (marketState.products || []).find(p => p.id === r.productId); }
function reservationArrival(r) { return r.arrival || reservationProduct(r)?.arrival; }
function cancellable(r) { const arrival = reservationArrival(r); return arrival && Date.now() < new Date(arrival).getTime() - 3600000; }

function productCard(p, fisher = false) {
  const left = remaining(p), percent = p.quantity ? (p.reserved / p.quantity) * 100 : 0;
  const fisherActions = isMine(p) ? `<select class="select-status" onchange="updateStatus('${p.id}', this.value)"><option ${p.status === '입항 예정' ? 'selected' : ''}>입항 예정</option><option ${p.status === '입항 중' ? 'selected' : ''}>입항 중</option><option ${p.status === '입항 완료' ? 'selected' : ''}>입항 완료</option></select><button class="edit" onclick="editProduct('${p.id}')">수정</button>` : '<span>내가 등록한 상품만 수정 가능</span>';
  const reserve = left > 0 && p.status !== '입항 완료' ? `<div class="reserve-row"><input id="qty-${p.id}" type="number" min="1" max="${left}" value="1" aria-label="예약 수량" /><button class="primary small" onclick="reserveProduct('${p.id}')">예약하기</button></div>` : '<b>예약 마감</b>';
  return `<article class="product"><div class="product-head">${p.photo ? `<img class="product-image" src="${p.photo}" alt="${escapeHtml(p.name)} 사진" />` : `<span class="fish-icon">${p.type === '못난이' ? '🐡' : '🐟'}</span>`}<div><h4>${escapeHtml(p.name)} ${p.type === '못난이' ? '<small style="color:#e26b2f">못난이</small>' : ''}</h4><p class="boat">${escapeHtml(p.boat)} · ${dateText(p.arrival)}</p></div><span class="status ${p.status === '입항 완료' ? 'arrived' : ''}">${p.status}</span></div><div class="meta"><span>가격 <strong>${won(p.price)}</strong></span><span>남은 수량 <strong>${left}개</strong></span></div><p class="pickup">📍 픽업: ${escapeHtml(p.pickup || '픽업 장소 미정')}</p><div class="progress"><i style="width:${percent}%"></i></div><div class="product-footer"><span>예약 ${p.reserved || 0}개 / 전체 ${p.quantity}개</span>${fisher ? fisherActions : reserve}</div></article>`;
}
function renderFisher() { const items = getProducts(), mine = items.filter(isMine); const reserved = mine.reduce((a, p) => a + Number(p.reserved || 0), 0), stock = mine.reduce((a, p) => a + remaining(p), 0), sales = mine.reduce((a, p) => a + Number(p.reserved || 0) * Number(p.price), 0); document.getElementById('fisherSummary').innerHTML = `<div class="summary"><span>예약 수량</span><strong>${reserved}개</strong></div><div class="summary"><span>남은 재고</span><strong>${stock}개</strong></div><div class="summary"><span>예상 매출</span><strong>${won(sales)}</strong></div>`; document.getElementById('fisherProducts').innerHTML = items.length ? items.map(p => productCard(p, true)).join('') : '<p class="empty">등록된 수산물이 없습니다.</p>'; }
function reservationRow(r, past = false) { const canCancel = !past && cancellable(r), arrival = reservationArrival(r); return `<div class="reservation ${past ? 'past-reservation' : ''}"><div><strong>${escapeHtml(r.name)} <small>${escapeHtml(r.boat)} · ${r.quantity}개 · ${past ? '구매 완료' : '입항'} ${arrival ? dateText(arrival) : '시간 정보 없음'}</small></strong></div><div class="reservation-actions"><b>${won(r.total)}</b>${past ? '' : `<button class="cancel" ${canCancel ? '' : 'disabled'} title="입항 예정 1시간 전까지만 취소할 수 있습니다." onclick="cancelReservation('${r.id}')">${canCancel ? '예약 취소' : '취소 마감'}</button>`}</div></div>`; }
function renderCitizen() { const search = (document.getElementById('productSearch')?.value || '').trim().toLowerCase(); const all = getProducts(), items = all.filter(p => !search || `${p.name} ${p.boat} ${p.type}`.toLowerCase().includes(search)); document.getElementById('productCount').textContent = `${items.length}건`; document.getElementById('citizenProducts').innerHTML = items.length ? items.map(p => productCard(p)).join('') : '<p class="empty">검색 결과가 없습니다.</p>'; const rs = getReservations().filter(isMyReservation); const upcoming = rs.filter(r => !reservationArrival(r) || new Date(reservationArrival(r)).getTime() > Date.now()), past = rs.filter(r => reservationArrival(r) && new Date(reservationArrival(r)).getTime() <= Date.now()); document.getElementById('reservationList').innerHTML = rs.length ? `<div class="reservation-group"><h4>예약 예정 <span>${upcoming.length}건</span></h4>${upcoming.length ? upcoming.map(r => reservationRow(r)).join('') : '<p class="empty">예약 예정 수산물이 없습니다.</p>'}</div><div class="reservation-group"><h4>이전에 산 상품 <span>${past.length}건</span></h4>${past.length ? past.map(r => reservationRow(r, true)).join('') : '<p class="empty">이전 구매 내역이 없습니다.</p>'}</div>` : '<p class="empty">아직 예약한 수산물이 없습니다.</p>'; }
function renderAll() { updateUserName(); renderFisher(); renderCitizen(); }
async function addProduct(e) { e.preventDefault(); if (!signedInUser) return showToast('로그인이 필요합니다.'); const file = productPhoto.files[0]; if (file && file.size > 500 * 1024) return showToast('사진은 500KB 이하로 선택해주세요.'); const photo = file ? await fileToDataUrl(file) : null, products = getProducts(), editingId = e.target.dataset.editing; if (editingId) { const item = products.find(p => p.id === editingId && isMine(p)); if (!item) return showToast('내가 등록한 상품만 수정할 수 있습니다.'); const quantity = Number(productQuantity.value); if (quantity < Number(item.reserved || 0)) return showToast(`예약 수량 ${item.reserved}개보다 적게 설정할 수 없습니다.`); Object.assign(item, { boat: boatName.value.trim(), name: productName.value.trim(), type: productType.value, price: Number(productPrice.value), quantity, arrival: arrivalTime.value, pickup: pickupLocation.value.trim(), photo: photo || item.photo || null }); delete e.target.dataset.editing; document.getElementById('productSubmit').textContent = '판매 정보 등록하기'; } else { products.unshift({ id: crypto.randomUUID(), owner: currentUser(), ownerId: currentUserId(), boat: boatName.value.trim(), name: productName.value.trim(), type: productType.value, price: Number(productPrice.value), quantity: Number(productQuantity.value), reserved: 0, arrival: arrivalTime.value, pickup: pickupLocation.value.trim(), photo, status: '입항 예정' }); } saveProducts(products); e.target.reset(); document.getElementById('photoPreview').classList.add('hidden'); e.target.classList.add('hidden'); renderAll(); showToast(editingId ? '상품 정보를 수정했습니다.' : '수산물 판매 정보를 등록했습니다.'); }
function editProduct(id) { const item = getProducts().find(p => p.id === id && isMine(p)); if (!item) return showToast('내가 등록한 상품만 수정할 수 있습니다.'); const form = document.getElementById('productForm'); boatName.value = item.boat; productName.value = item.name; productType.value = item.type; productPrice.value = item.price; productQuantity.value = item.quantity; arrivalTime.value = item.arrival; pickupLocation.value = item.pickup || ''; const preview = document.getElementById('photoPreview'); if (item.photo) { preview.src = item.photo; preview.classList.remove('hidden'); } else preview.classList.add('hidden'); form.dataset.editing = id; document.getElementById('productSubmit').textContent = '상품 정보 저장하기'; form.classList.remove('hidden'); form.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function updateStatus(id, status) { const products = getProducts(), product = products.find(p => p.id === id && isMine(p)); if (!product) return showToast('내가 등록한 상품만 변경할 수 있습니다.'); product.status = status; saveProducts(products); renderAll(); showToast('입항 상태를 변경했습니다.'); }
function reserveProduct(id) { if (!signedInUser) return showToast('로그인 후 예약할 수 있습니다.'); const products = getProducts(), product = products.find(p => p.id === id), qty = Number(document.getElementById(`qty-${id}`).value); if (!product || !Number.isInteger(qty) || qty < 1 || qty > remaining(product)) return showToast('남은 수량 안에서 선택해주세요.'); product.reserved = Number(product.reserved || 0) + qty; const reservations = getReservations(); reservations.unshift({ id: crypto.randomUUID(), productId: product.id, user: currentUser(), userId: currentUserId(), name: product.name, boat: product.boat, quantity: qty, total: qty * product.price, arrival: product.arrival, status: product.status }); marketState = { products, reservations }; persistMarket(); renderAll(); showToast(`${product.name} ${qty}개를 예약했습니다.`); }
function cancelReservation(id) { const reservations = getReservations(), reservation = reservations.find(r => r.id === id && isMyReservation(r)); if (!reservation) return showToast('내 예약을 찾을 수 없습니다.'); if (!cancellable(reservation)) return showToast('입항 예정 1시간 전부터는 예약을 취소할 수 없습니다.'); const products = getProducts(), product = products.find(p => p.id === reservation.productId); if (!product) return showToast('수산물 정보를 찾을 수 없습니다.'); product.reserved = Math.max(0, Number(product.reserved || 0) - Number(reservation.quantity)); marketState = { products, reservations: reservations.filter(r => r.id !== id) }; persistMarket(); renderAll(); showToast('예약을 취소했고 재고에 반영했습니다.'); }

Object.assign(window, { setAuthMode, submitAuth, startAs, goHome, logout, toggleProductForm, addProduct, editProduct, updateStatus, reserveProduct, cancelReservation, previewPhoto, renderCitizen });
document.addEventListener('DOMContentLoaded', () => { const now = new Date(); now.setHours(now.getHours() + 3); document.getElementById('arrivalTime').value = now.toISOString().slice(0, 16); onAuthStateChanged(auth, user => { signedInUser = user; updateUserName(); renderAll(); }); initializeFirebase().catch(() => showToast('Firebase 초기화에 실패했습니다.')); });
