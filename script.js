import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = { apiKey: 'AIzaSyDPSJ8xGO9_EiIqj9tJGzYV0yU9kFWtmyI', authDomain: 'bada-market-a0025.firebaseapp.com', projectId: 'bada-market-a0025', storageBucket: 'bada-market-a0025.firebasestorage.app', messagingSenderId: '560692888958', appId: '1:560692888958:web:46ea3303e6fe034ad09f2f' };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const marketRef = doc(db, 'market', 'state');
let marketState = { products: [], reservations: [], reviews: [] };
let signedInUser = null;
let authMode = 'login';

const $ = id => document.getElementById(id);
const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;
const remaining = product => Math.max(0, Number(product.quantity || 0) - Number(product.reserved || 0));
const unitOf = item => item?.unit === 'kg' ? 'kg' : '개';
const quantityText = (value, item) => `${Number(value || 0)}${unitOf(item)}`;
const priceText = product => unitOf(product) === 'kg' ? `${won(product.price)} / 0.1kg` : `${won(product.price)} / 개`;
const unitSummary = (items, valueOf) => ['개','kg'].map(unit => { const total = items.filter(item => unitOf(item) === unit).reduce((sum, item) => sum + Number(valueOf(item) || 0), 0); return total ? `${total}${unit}` : ''; }).filter(Boolean).join(' · ') || '0';
const dateText = value => { const d = new Date(value); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const currentName = () => signedInUser?.displayName || signedInUser?.email?.split('@')[0] || '';
const currentId = () => signedInUser?.uid || '';
const mine = item => item.ownerId ? item.ownerId === currentId() : item.owner === currentName();
const myReservation = item => item.userId ? item.userId === currentId() : item.user === currentName();
const products = () => (marketState.products || []).filter(p => new Date(p.arrival).getTime() > Date.now());
const reservations = () => marketState.reservations || [];
const reviews = () => marketState.reviews || [];
const productFor = reservation => (marketState.products || []).find(product => product.id === reservation.productId);
function sellerRating(product) { const sellerId = product?.ownerId || product?.owner || ''; const rows = reviews().filter(review => (review.sellerId || review.seller) === sellerId); return rows.length ? (rows.reduce((sum, review) => sum + Number(review.rating || 0), 0) / rows.length).toFixed(1) : null; }
function sellerText(product) { const name = product?.owner || '판매자'; const rating = sellerRating(product); return `${escapeHtml(name)} ${rating ? `· ⭐ ${rating}` : '· ⭐ 평점 없음'}`; }

function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
function save() { setDoc(marketRef, marketState).catch(() => toast('데이터 저장에 실패했습니다.')); }
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('loginTab').classList.toggle('active', !signup);
  $('signupTab').classList.toggle('active', signup);
  $('signupNickname').classList.toggle('hidden', !signup);
  $('signupConfirm').classList.toggle('hidden', !signup);
  $('nickname').required = signup;
  $('passwordConfirm').required = signup;
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  $('authSubmit').textContent = signup ? '회원가입 완료' : '로그인';
  $('authGuide').textContent = signup ? '이메일 계정과 비밀번호로 가입하면 다음부터 로그인할 수 있어요.' : '가입한 이메일과 비밀번호로 로그인하세요.';
}
function togglePassword(inputId, button) {
  const input = $(inputId);
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  button.textContent = visible ? '보기' : '숨기기';
  button.setAttribute('aria-label', visible ? '비밀번호 보기' : '비밀번호 숨기기');
}
function authMessage(error) {
  return ({ 'auth/email-already-in-use':'이미 가입된 이메일입니다.', 'auth/invalid-credential':'이메일 또는 비밀번호가 맞지 않습니다.', 'auth/invalid-email':'올바른 이메일 주소를 입력하세요.', 'auth/weak-password':'비밀번호는 6자리 이상이어야 합니다.' }[error.code] || '계정 처리 중 문제가 생겼습니다.');
}
async function submitAuth(event) {
  event.preventDefault();
  const email = $('email').value.trim(), password = $('password').value, button = $('authSubmit');
  if (authMode === 'signup') {
    const nickname = $('nickname').value.trim();
    if (!nickname) return toast('닉네임을 입력하세요.');
    if (password !== $('passwordConfirm').value) return toast('비밀번호 확인이 일치하지 않습니다.');
  }
  button.disabled = true;
  try {
    if (authMode === 'signup') {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: $('nickname').value.trim() });
      toast('회원가입이 완료되었습니다.');
    } else { await signInWithEmailAndPassword(auth, email, password); toast('로그인되었습니다.'); }
    $('authForm').reset();
  } catch (error) { toast(authMessage(error)); }
  finally { button.disabled = false; }
}
async function logout() { await signOut(auth); goHome(); toast('로그아웃되었습니다.'); }
function updateNames() { document.querySelectorAll('.user-name').forEach(el => el.textContent = currentName()); }
function startAs(role) { if (!signedInUser) return toast('로그인 후 이용할 수 있습니다.'); $('roleScreen').classList.add('hidden'); $(role + 'Screen').classList.remove('hidden'); renderAll(); }
function goHome() { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); $('roleScreen').classList.remove('hidden'); }
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
async function previewPhoto(event) { const file = event.target.files[0]; if (!file) return $('photoPreview').classList.add('hidden'); if (file.size > 500 * 1024) { event.target.value = ''; return toast('사진은 500KB 이하만 등록할 수 있습니다.'); } $('photoPreview').src = await fileToDataUrl(file); $('photoPreview').classList.remove('hidden'); }
function toggleProductForm() { const form = $('productForm'); form.classList.toggle('hidden'); if (!form.dataset.editing) form.reset(); }
function updatePriceLabel() { $('priceLabel').childNodes[0].textContent = $('quantityUnit').value === 'kg' ? '가격 (원 / 0.1kg)' : '가격 (원 / 개)'; }
function card(product, fisher = false) {
  const left = remaining(product), percent = product.quantity ? Number(product.reserved || 0) / product.quantity * 100 : 0;
  const status = product.status || '입항 예정';
  const fisherControls = mine(product) ? `<select class="select-status" onchange="updateStatus('${product.id}',this.value)"><option ${status === '입항 예정' ? 'selected':''}>입항 예정</option><option ${status === '입항 중' ? 'selected':''}>입항 중</option><option ${status === '입항 완료' ? 'selected':''}>입항 완료</option></select><button class="edit" onclick="editProduct('${product.id}')">수정</button>` : '';
  const reserve = left > 0 && status !== '입항 완료' ? `<div class="reserve-row"><input id="qty-${product.id}" type="number" min="${unitOf(product) === 'kg' ? '0.1' : '1'}" step="${unitOf(product) === 'kg' ? '0.1' : '1'}" max="${left}" value="${unitOf(product) === 'kg' ? '0.1' : '1'}" aria-label="예약 수량"><button class="primary small" onclick="reserveProduct('${product.id}')">예약하기</button></div>` : '<b>예약 마감</b>';
  return `<article class="product"><div class="product-head">${product.photo ? `<img class="product-image" src="${product.photo}" alt="${escapeHtml(product.name)} 사진">` : '<span class="fish-icon">🐟</span>'}<div><h4>${escapeHtml(product.name)}</h4><p class="boat">${escapeHtml(product.boat)} · 입항시간 ${dateText(product.arrival)}</p><p class="boat">판매자 ${sellerText(product)}</p></div><span class="status ${status === '입항 완료' ? 'arrived':''}">${status}</span></div><div class="meta"><span>가격 <strong>${priceText(product)}</strong></span><span>남은 수량 <strong>${quantityText(left, product)}</strong></span></div><p class="pickup">📍 픽업: ${escapeHtml(product.pickup || '픽업 장소 미정')}</p>${product.message ? `<p class="seller-message">💬 ${escapeHtml(product.message)}</p>` : ''}<div class="progress"><i style="width:${percent}%"></i></div><div class="product-footer"><span>예약 ${quantityText(product.reserved, product)} / 전체 ${quantityText(product.quantity, product)}</span>${fisher ? fisherControls : reserve}</div></article>`;
}
function renderFisher() {
  const list = products(), mineList = list.filter(mine), reserved = mineList.reduce((sum,p) => sum + Number(p.reserved || 0),0), stock = mineList.reduce((sum,p) => sum + remaining(p),0), sales = mineList.reduce((sum,p) => sum + Number(p.reserved || 0) * Number(p.price || 0),0);
  $('fisherSummary').innerHTML = `<div class="summary"><span>예약 수량</span><strong>${unitSummary(mineList, p => p.reserved)}</strong></div><div class="summary"><span>남은 재고</span><strong>${unitSummary(mineList, remaining)}</strong></div><div class="summary"><span>예상 매출</span><strong>${won(sales)}</strong></div>`;
  $('fisherProducts').innerHTML = list.length ? list.map(p => card(p, true)).join('') : '<p class="empty">등록된 수산물이 없습니다.</p>';
}
function arrivalOf(reservation) { return reservation.arrival || marketState.products?.find(p => p.id === reservation.productId)?.arrival; }
function reservationRow(reservation, past) { const arrival = arrivalOf(reservation), cancellable = arrival && Date.now() < new Date(arrival).getTime() - 3600000, product = productFor(reservation), reviewed = reviews().some(review => review.reservationId === reservation.id && (review.reviewerId || review.reviewer) === (currentId() || currentName())); const reviewButtons = `<div class="review-buttons"><span>별점 남기기</span>${[1,2,3,4,5].map(score => `<button type="button" onclick="submitReview('${reservation.id}',${score})" aria-label="${score}점">${'⭐'.repeat(score)}</button>`).join('')}</div>`; return `<div class="reservation ${past ? 'past-reservation':''}"><div><strong>${escapeHtml(reservation.name)} <small>${escapeHtml(reservation.boat)} · ${quantityText(reservation.quantity, reservation)} · ${arrival ? dateText(arrival) : ''}</small>${past ? `<small>판매자 ${sellerText(product || { owner: reservation.sellerName, ownerId: reservation.sellerId })}</small>` : ''}</strong>${past ? (reviewed ? '<p class="review-done">리뷰를 등록했어요.</p>' : reviewButtons) : ''}</div><div class="reservation-actions"><b>${won(reservation.total)}</b>${past ? '' : `<button class="cancel" ${cancellable ? '' : 'disabled'} onclick="cancelReservation('${reservation.id}')">${cancellable ? '예약 취소' : '취소 마감'}</button>`}</div></div>`; }
function renderCitizen() {
  const search = ($('productSearch')?.value || '').trim().toLowerCase(), list = products().filter(p => !search || `${p.name} ${p.boat} ${p.type || ''}`.toLowerCase().includes(search));
  $('productCount').textContent = `${list.length}건`; $('citizenProducts').innerHTML = list.length ? list.map(p => card(p)).join('') : '<p class="empty">검색 결과가 없습니다.</p>';
  const mineRows = reservations().filter(myReservation), upcoming = mineRows.filter(r => !arrivalOf(r) || new Date(arrivalOf(r)).getTime() > Date.now()), past = mineRows.filter(r => arrivalOf(r) && new Date(arrivalOf(r)).getTime() <= Date.now());
  $('reservationList').innerHTML = `<div class="reservation-group"><h4>예약 예정 <span>${upcoming.length}건</span></h4>${upcoming.length ? upcoming.map(r => reservationRow(r,false)).join('') : '<p class="empty">예약 예정 상품이 없습니다.</p>'}</div><div class="reservation-group"><h4>이전에 산 상품 <span>${past.length}건</span></h4>${past.length ? past.map(r => reservationRow(r,true)).join('') : '<p class="empty">이전 구매 내역이 없습니다.</p>'}</div>`;
}
async function addProduct(event) { event.preventDefault(); const form = event.target, file = $('productPhoto').files[0]; if (file && file.size > 500 * 1024) return toast('사진은 500KB 이하만 등록할 수 있습니다.'); const photo = file ? await fileToDataUrl(file) : null, all = marketState.products || [], editing = form.dataset.editing;
  const data = { boat:$('boatName').value.trim(), name:$('productName').value.trim(), type:$('productType').value, price:Number($('productPrice').value), quantity:Number($('productQuantity').value), unit:$('quantityUnit').value, arrival:$('arrivalTime').value, pickup:$('pickupLocation').value.trim(), message:$('sellerMessage').value.trim() };
  if (editing) { const item = all.find(p => p.id === editing && mine(p)); if (!item) return toast('내 상품만 수정할 수 있습니다.'); if (data.quantity < Number(item.reserved || 0)) return toast('예약 수량보다 적게 설정할 수 없습니다.'); Object.assign(item, data, { photo:photo || item.photo || null }); delete form.dataset.editing; } else all.unshift({ id:crypto.randomUUID(), owner:currentName(), ownerId:currentId(), reserved:0, status:'입항 예정', photo, ...data });
  marketState.products = all; save(); form.reset(); form.classList.add('hidden'); renderAll(); toast(editing ? '상품 정보를 수정했습니다.' : '수산물을 등록했습니다.'); }
function editProduct(id) { const item = (marketState.products || []).find(p => p.id === id && mine(p)); if (!item) return toast('내 상품만 수정할 수 있습니다.'); const form = $('productForm'); $('boatName').value=item.boat; $('productName').value=item.name; $('productType').value=item.type; $('productPrice').value=item.price; $('productQuantity').value=item.quantity; $('quantityUnit').value=unitOf(item); updatePriceLabel(); $('arrivalTime').value=item.arrival; $('pickupLocation').value=item.pickup || ''; $('sellerMessage').value=item.message || ''; form.dataset.editing=id; form.classList.remove('hidden'); }
function updateStatus(id,status) { const item=(marketState.products || []).find(p=>p.id===id && mine(p)); if (!item) return; item.status=status; save(); renderAll(); }
function reserveProduct(id) { const product=(marketState.products || []).find(p=>p.id===id), qty=Number($(`qty-${id}`).value), minimum=unitOf(product) === 'kg' ? 0.1 : 1; if (!product || qty < minimum || qty > remaining(product)) return toast('남은 수량 안에서 선택하세요.'); product.reserved=Number(product.reserved || 0)+qty; marketState.reservations=[{id:crypto.randomUUID(),productId:id,user:currentName(),userId:currentId(),name:product.name,boat:product.boat,quantity:qty,unit:unitOf(product),total:(unitOf(product) === 'kg' ? qty / 0.1 : qty)*product.price,arrival:product.arrival,sellerName:product.owner,sellerId:product.ownerId},...reservations()]; save(); renderAll(); toast('예약되었습니다.'); }
function submitReview(reservationId, rating) { const reservation = reservations().find(row => row.id === reservationId && myReservation(row)); const product = reservation && productFor(reservation); if (!reservation || !arrivalOf(reservation) || new Date(arrivalOf(reservation)).getTime() > Date.now()) return toast('입항이 완료된 상품만 리뷰를 남길 수 있습니다.'); if (reviews().some(review => review.reservationId === reservationId && (review.reviewerId || review.reviewer) === (currentId() || currentName()))) return toast('이 구매 건에는 이미 리뷰를 남겼습니다.'); marketState.reviews=[{id:crypto.randomUUID(),reservationId,reviewer:currentName(),reviewerId:currentId(),seller:product?.owner || reservation.sellerName || '',sellerId:product?.ownerId || reservation.sellerId || '',rating:Number(rating)},...reviews()]; save(); renderAll(); toast(`${rating}점 리뷰를 등록했습니다.`); }
function cancelReservation(id) { const row=reservations().find(r=>r.id===id && myReservation(r)), arrival=row && arrivalOf(row); if (!row || !arrival || Date.now() >= new Date(arrival).getTime()-3600000) return toast('입항 1시간 전까지만 취소할 수 있습니다.'); const product=(marketState.products || []).find(p=>p.id===row.productId); if (product) product.reserved=Math.max(0,Number(product.reserved || 0)-Number(row.quantity)); marketState.reservations=reservations().filter(r=>r.id!==id); save(); renderAll(); toast('예약이 취소되었습니다.'); }
function renderAll() { updateNames(); renderFisher(); renderCitizen(); }
Object.assign(window,{setAuthMode,togglePassword,submitAuth,startAs,goHome,logout,previewPhoto,toggleProductForm,updatePriceLabel,addProduct,editProduct,updateStatus,reserveProduct,cancelReservation,submitReview,renderCitizen});
document.addEventListener('DOMContentLoaded',()=>{ const date=new Date(Date.now()+3*3600000); if ($('arrivalTime')) $('arrivalTime').value=date.toISOString().slice(0,16); onAuthStateChanged(auth,user=>{ signedInUser=user; document.querySelector('.login-box').classList.toggle('hidden', !!user); renderAll(); }); getDoc(marketRef).then(snapshot=>{ if (!snapshot.exists()) return setDoc(marketRef,marketState); }).catch(()=>toast('Firebase 연결을 확인하세요.')); onSnapshot(marketRef,snapshot=>{ if(snapshot.exists()){ marketState=snapshot.data(); renderAll(); } }); });
