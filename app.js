const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];
let currentSortColumn = '';
let isAscending = true;

// 🔒 [수정] 페이지 로드 시 로그인 상태를 먼저 체크합니다.
window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // 로그인 세션이 없으면 로그인 페이지로 튕겨냅니다.
        alert('로그인이 필요한 페이지입니다.');
        window.location.href = 'login.html';
    } else {
        // 로그인 세션이 있으면 정상적으로 데이터를 불러옵니다.
        loadRecords();
    }
};

// 🔓 [추가] 로그아웃 처리 함수
async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('로그아웃 실패: ' + error.message);
    } else {
        alert('로그아웃 되었습니다.');
        window.location.href = 'login.html';
    }
}

// 1. 데이터 불러오기
async function loadRecords() {
    const tableBody = document.getElementById('tableBody');
    
    const { data, error } = await supabaseClient
        .from('records')
        .select(`
            song_id,
            casual_score,
            normal_score,
            hard_score,
            expert_score,
            songs (
                title,
                composer,
                casual_level,
                normal_level,
                hard_level,
                expert_level
            )
        `);

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">오류 발생: ${error.message}</td></tr>`;
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">등록된 데이터가 없습니다. DB 또는 RLS 설정을 확인하세요.</td></tr>';
        return;
    }

    fetchedData = data;
    renderTable(fetchedData);
}

// 2. 데이터를 테이블 구조로 화면에 그리는 함수
function renderTable(dataList) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    dataList.forEach(item => {
        const song = item.songs;
        if (!song) return;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function() { selectSong(item.song_id); };

        const s = (score) => (score !== null && score !== undefined) ? score.toLocaleString() : '-';
        const l = (level) => (level !== null && level !== undefined) ? `(Lv.${level})` : '';

        tr.innerHTML = `
            <td>${item.song_id}</td>
            <td style="text-align: left;">
                <strong>${song.title}</strong><br>
                <small style="color:#888">${song.composer || ''}</small>
            </td>
            <td><strong>${s(item.casual_score)}</strong> <div class="level-badge">${l(song.casual_level)}</div></td>
            <td><strong>${s(item.normal_score)}</strong> <div class="level-badge">${l(song.normal_level)}</div></td>
            <td><strong>${s(item.hard_score)}</strong> <div class="level-badge">${l(song.hard_level)}</div></td>
            <td><strong>${s(item.expert_score)}</strong> <div class="level-badge">${l(song.expert_level)}</div></td>
        `;
        tableBody.appendChild(tr);
    });
}

function selectSong(songId) {
    document.getElementById('songId').value = songId;
    document.getElementById('songId').focus();
}

// 3. 정렬 처리 함수
function sortTable(column) {
    if (currentSortColumn === column) {
        isAscending = !isAscending;
    } else {
        currentSortColumn = column;
        isAscending = true;
    }

    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = '↕');
    const currentIcon = document.getElementById(`icon-${column}`);
    if (currentIcon) {
        currentIcon.innerText = isAscending ? '▲' : '▼';
    }

    fetchedData.sort((a, b) => {
        let valA, valB;

        if (column === 'title') {
            valA = a.songs ? a.songs.title : '';
            valB = b.songs ? b.songs.title : '';
            return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            valA = a[column] || 0;
            valB = b[column] || 0;
            return isAscending ? valA - valB : valB - valA;
        }
    });

    renderTable(fetchedData);
}

// 4. 데이터 저장 및 수정
async function saveRecord() {
    const songId = document.getElementById('songId').value;
    if (!songId) {
        alert('곡 ID를 입력하거나 아래 표에서 곡을 클릭해 주세요.');
        return;
    }

    const casualInput = document.getElementById('casualScore').value;
    const normalInput = document.getElementById('normalScore').value;
    const hardInput = document.getElementById('hardScore').value;
    const expertInput = document.getElementById('expertScore').value;

    const existingRecord = fetchedData.find(item => item.song_id === parseInt(songId));

    const rowData = {
        song_id: parseInt(songId),
        casual_score: casualInput ? parseInt(casualInput) : (existingRecord ? existingRecord.casual_score : null),
        normal_score: normalInput ? parseInt(normalInput) : (existingRecord ? existingRecord.normal_score : null),
        hard_score: hardInput ? parseInt(hardInput) : (existingRecord ? existingRecord.hard_score : null),
        expert_score: expertInput ? parseInt(expertInput) : (existingRecord ? existingRecord.expert_score : null)
    };

    const { error } = await supabaseClient
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (error) {
        alert('저장 실패: ' + error.message);
    } else {
        alert('기록이 성공적으로 반영되었습니다!');
        
        document.getElementById('songId').value = '';
        document.getElementById('casualScore').value = '';
        document.getElementById('normalScore').value = '';
        document.getElementById('hardScore').value = '';
        document.getElementById('expertScore').value = '';
        
        loadRecords();
    }
}