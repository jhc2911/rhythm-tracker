const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];
let currentSortColumn = '';
let isAscending = true;

window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert('로그인이 필요한 페이지입니다.');
        window.location.href = 'login.html';
    } else {
        loadRecords();
    }
};

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

    fetchedData = data || [];
    renderTable(fetchedData);
    updateSongTitleDisplay(); // 로드 완료 후 화면 상태 리프레시
}

// 2. 데이터를 테이블 구조로 화면에 그리는 함수
function renderTable(dataList) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    if (dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">등록된 데이터가 없습니다.</td></tr>';
        return;
    }

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
            <td class="song-info-cell">
                <strong class="song-title">${song.title}</strong>
                <span class="song-composer">${song.composer || 'Unknown Composer'}</span>
            </td>
            <td class="col-casual"><strong>${s(item.casual_score)}</strong><br><div class="level-badge">${l(song.casual_level)}</div></td>
            <td class="col-normal"><strong>${s(item.normal_score)}</strong><br><div class="level-badge">${l(song.normal_level)}</div></td>
            <td class="col-hard"><strong>${s(item.hard_score)}</strong><br><div class="level-badge">${l(song.hard_level)}</div></td>
            <td class="col-expert"><strong>${s(item.expert_score)}</strong><br><div class="level-badge">${l(song.expert_level)}</div></td>
        `;
        tableBody.appendChild(tr);
    });
}

// 표에서 곡 클릭 시 처리
function selectSong(songId) {
    document.getElementById('songId').value = songId;
    updateSongTitleDisplay();
    document.getElementById('songId').focus();
}

// ✨ [추가] 곡 ID 입력 혹은 선택 시 우측에 곡 제목 표시 및 신규 등록 창 활성화 함수
function updateSongTitleDisplay() {
    const songIdInput = document.getElementById('songId').value;
    const displayArea = document.getElementById('songTitleDisplay');
    
    if (!songIdInput) {
        displayArea.innerHTML = '<span style="color:#aaa; font-weight:normal;">곡 ID를 입력하거나 아래 표에서 곡을 선택하세요.</span>';
        return;
    }

    const targetId = parseInt(songIdInput);
    // 전역 변수에서 일치하는 곡 검색
    const found = fetchedData.find(item => item.song_id === targetId);

    if (found && found.songs) {
        displayArea.innerHTML = `선택된 곡: <span style="color:#2ec71">${found.songs.title}</span>`;
    } else {
        // DB에 없는 새로운 곡 ID일 경우 직접 제목을 타이핑할 수 있게 인풋 필드를 보여줍니다.
        displayArea.innerHTML = `
            <span class="new-song-badge">신규 악곡 등록 모드</span><br>
            <input type="text" id="newSongTitle" class="new-title-input" style="display:block;" placeholder="새로운 곡의 제목을 입력하세요">
        `;
    }
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

// 4. 데이터 저장 및 안전한 수정 + [신규 등록 확장]
async function saveRecord() {
    const songId = document.getElementById('songId').value;
    if (!songId) {
        alert('곡 ID를 지정해주세요.');
        return;
    }

    const targetId = parseInt(songId);
    const casualInput = document.getElementById('casualScore').value;
    const normalInput = document.getElementById('normalScore').value;
    const hardInput = document.getElementById('hardScore').value;
    const expertInput = document.getElementById('expertScore').value;

    const existingRecord = fetchedData.find(item => item.song_id === targetId);

    // 💡 만약 새로운 곡 ID라면 songs 테이블에 먼저 저장 처리를 진행합니다.
    if (!existingRecord) {
        const newTitleInput = document.getElementById('newSongTitle');
        const newTitle = newTitleInput ? newTitleInput.value.trim() : '';
        
        if (!newTitle) {
            alert('새로운 곡의 ID입니다. 악곡 제목을 입력해주세요.');
            if(newTitleInput) newTitleInput.focus();
            return;
        }

        // songs 테이블에 새 곡 정보 입력
        const { error: songError } = await supabaseClient
            .from('songs')
            .upsert([{ id: targetId, title: newTitle, composer: 'Unknown Composer' }]);

        if (songError) {
            alert('새로운 곡 등록 실패(songs): ' + songError.message);
            return;
        }
    }

    // records 테이블 데이터 구성 및 업서트
    const rowData = {
        song_id: targetId,
        casual_score: casualInput ? parseInt(casualInput) : (existingRecord ? existingRecord.casual_score : null),
        normal_score: normalInput ? parseInt(normalInput) : (existingRecord ? existingRecord.normal_score : null),
        hard_score: hardInput ? parseInt(hardInput) : (existingRecord ? existingRecord.hard_score : null),
        expert_score: expertInput ? parseInt(expertInput) : (existingRecord ? existingRecord.expert_score : null)
    };

    const { error: recordError } = await supabaseClient
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (recordError) {
        alert('점수 저장 실패: ' + recordError.message);
    } else {
        alert('기록이 성공적으로 반영되었습니다!');
        
        // 인풋 초기화
        document.getElementById('songId').value = '';
        document.getElementById('casualScore').value = '';
        document.getElementById('normalScore').value = '';
        document.getElementById('hardScore').value = '';
        document.getElementById('expertScore').value = '';
        
        loadRecords();
    }
}