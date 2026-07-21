const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];      // 유저의 플레이 기록 (records 테이블)
let allSongsList = [];     // 전체 곡 목록 (songs 테이블)

// [기본 정렬 설정]
let currentSortColumn = 'title'; 
let isAscending = true;          

window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert('로그인이 필요한 페이지입니다.');
        window.location.href = 'login.html';
    } else {
        await loadAllSongs(); // 1. 전체 곡 데이터 먼저 로드
        await loadRecords();  // 2. 내 플레이 기록 로드
    }
};

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// 0. 전체 songs 데이터 로드 (드롭다운 및 전체 검색용)
async function loadAllSongs() {
    const { data, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('id', { ascending: true });

    if (!error && data) {
        allSongsList = data;
    } else {
        console.error('songs 테이블 로드 오류:', error);
    }
}

// 1. 플레이 기록 데이터 불러오기
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
            casual_status,
            normal_status,
            hard_status,
            expert_status,
            songs (
                title,
                composer,
                casual_level,
                normal_level,
                hard_level,
                expert_level,
                casual_notes,
                normal_notes,
                hard_notes,
                expert_notes,
                pack_name
            )
        `);

    if (error) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" style="color:red;">오류 발생: ${error.message}</td></tr>`;
        return;
    }

    fetchedData = data || [];

    applySort(currentSortColumn, isAscending);
    updateSortIcons();
    renderTable(fetchedData);
    renderStatsTable();
}

// 공통 정렬 로직 함수
function applySort(column, ascending) {
    fetchedData.sort((a, b) => {
        let valA, valB;
        if (column === 'title') {
            valA = a.songs ? a.songs.title.toLowerCase() : '';
            valB = b.songs ? b.songs.title.toLowerCase() : '';
            return ascending ? valA.localeCompare(valB, 'ko', { sensitivity: 'base' }) : valB.localeCompare(valA, 'ko', { sensitivity: 'base' });
        } else {
            valA = a[column] === null || a[column] === undefined ? -1 : a[column];
            valB = b[column] === null || b[column] === undefined ? -1 : b[column];
            return ascending ? valA - valB : valB - valA;
        }
    });
}

// 정렬 상태에 따라 표 헤더의 삼각형(▲/▼) 아이콘을 업데이트하는 함수
function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = '↕');
    const currentIcon = document.getElementById(`icon-${currentSortColumn}`);
    if (currentIcon) {
        currentIcon.innerText = isAscending ? '▲' : '▼';
    }
}

function getScoreHTML(score, status, totalNotes) {
    if (score === null || score === undefined) return '<span style="color:#aaa">-</span>';
    
    let styleClass = 'status-clear';
    let badgeHTML = '';
    let missedText = ''; 

    if (status === 'AP' && totalNotes) {
        const maxScore = 1000000 + totalNotes;
        if (score < maxScore) {
            const missedCount = maxScore - score;
            missedText = `<span style="font-size: 11px; color: #ff6b6b; font-weight: normal; margin-left: 4px;"><b>(-${missedCount})</b></span>`;
        }
    }

    if (status === 'FC') {
        styleClass = 'status-fc';
        badgeHTML = '<span class="status-badge badge-fc">FC</span>';
    } else if (status === 'AP') {
        styleClass = 'status-ap';
        badgeHTML = '<span class="status-badge badge-ap">AP</span>';
    } else if (status === 'AP+') {
        styleClass = 'status-applus'; 
        badgeHTML = '<span class="status-badge badge-applus">AP+</span>';
    }

    return `
        <div style="display: inline-flex; align-items: center; justify-content: flex-start; text-align: left;">
            <span class="score-text ${styleClass}">${score.toLocaleString()}</span>
            <span style="display: inline-flex; align-items: center; margin-left: 6px;">
                ${badgeHTML}${missedText}
            </span>
        </div>
    `;
}

// 2. 테이블 렌더링
function renderTable(dataList) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">등록된 데이터가 없습니다.</td></tr>';
        return;
    }

    dataList.forEach(item => {
        const song = item.songs;
        if (!song) return;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function() { selectSong(item.song_id); };

        const l = (level) => {
            if (level === null || level === undefined) return '';
            return `
                <div style="font-size: 11px; color: #888; margin-top: 3px; text-align: center; width: 100%;">
                    (Lv.${level})
                </div>
            `;
        };

        const isGraduated = item.casual_status === 'AP+' && 
                            item.normal_status === 'AP+' && 
                            item.hard_status === 'AP+' && 
                            item.expert_status === 'AP+';

        const songCellClass = isGraduated ? 'song-info-cell graduated-song-cell' : 'song-info-cell';
        const masterBadge = isGraduated ? '<span class="graduated-badge">🏅 MASTER</span>' : '';
        const packName = song.pack_name || 'TRACING THE STARS';

        tr.innerHTML = `
            <td class="${songCellClass}">
                <div>
                    <div>
                        <strong class="song-title" style="display:inline-block; vertical-align:middle;">${song.title}</strong>${masterBadge}
                    </div>
                    <span class="song-composer" style="display:block; margin-top:2px;">${song.composer || 'Unknown Composer'}</span>
                </div>
                <span class="pack-name-text">${packName}</span>
            </td>
            <td class="col-casual" style="text-align: center; vertical-align: middle;">${getScoreHTML(item.casual_score, item.casual_status, song.casual_notes)}${l(song.casual_level)}</td>
            <td class="col-normal" style="text-align: center; vertical-align: middle;">${getScoreHTML(item.normal_score, item.normal_status, song.normal_notes)}${l(song.normal_level)}</td>
            <td class="col-hard" style="text-align: center; vertical-align: middle;">${getScoreHTML(item.hard_score, item.hard_status, song.hard_notes)}${l(song.hard_level)}</td>
            <td class="col-expert" style="text-align: center; vertical-align: middle;">${getScoreHTML(item.expert_score, item.expert_status, song.expert_notes)}${l(song.expert_level)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ✨ 공통: 선택된 곡의 기존 기록 및 정보 폼에 바인딩
function loadExistingRecord(songId) {
    const record = fetchedData.find(item => item.song_id === songId);
    
    if (record) {
        document.getElementById('casualScore').value = record.casual_score || '';
        document.getElementById('normalScore').value = record.normal_score || '';
        document.getElementById('hardScore').value = record.hard_score || '';
        document.getElementById('expertScore').value = record.expert_score || '';
        
        document.getElementById('casualStatus').value = record.casual_status || 'CLEAR';
        document.getElementById('normalStatus').value = record.normal_status || 'CLEAR';
        document.getElementById('hardStatus').value = record.hard_status || 'CLEAR';
        document.getElementById('expertStatus').value = record.expert_status || 'CLEAR';
    } else {
        clearFormScores();
    }
}

function clearFormScores() {
    ['casual', 'normal', 'hard', 'expert'].forEach(diff => {
        const scoreInput = document.getElementById(`${diff}Score`);
        const statusSelect = document.getElementById(`${diff}Status`);
        if (scoreInput) scoreInput.value = '';
        if (statusSelect) statusSelect.value = 'CLEAR';
    });
}

// ✨ 표에서 행 클릭 시 실행되는 함수
function selectSong(songId) {
    const songIdInput = document.getElementById('songId');
    const titleInput = document.getElementById('songTitleInput');
    
    songIdInput.value = songId;
    
    // allSongsList에서 곡 제목 가져와 채우기
    const foundSong = allSongsList.find(s => Number(s.id) === Number(songId));
    if (foundSong && titleInput) {
        titleInput.value = foundSong.title;
    }

    loadExistingRecord(songId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ✨ 곡 ID 입력창 제어 (수동 ID 입력 시)
function onSongIdInput() {
    const songIdVal = document.getElementById('songId').value;
    const titleInput = document.getElementById('songTitleInput');
    
    if (!songIdVal) {
        if (titleInput) titleInput.value = '';
        clearFormScores();
        return;
    }

    const targetId = parseInt(songIdVal);
    const foundSong = allSongsList.find(s => Number(s.id) === targetId);

    if (foundSong) {
        if (titleInput) titleInput.value = foundSong.title;
        loadExistingRecord(targetId);
    } else {
        if (titleInput) titleInput.value = '';
        clearFormScores();
    }
}

// ✨ 곡 제목 드롭다운 및 검색 로직
function showSongDropdown() {
    filterSongDropdown();
}

function filterSongDropdown() {
    const titleInput = document.getElementById('songTitleInput');
    const dropdown = document.getElementById('songDropdownList');
    if (!titleInput || !dropdown) return;

    const keyword = titleInput.value.trim().toLowerCase();

    if (!allSongsList || allSongsList.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-item" style="color:#aaa; cursor:default;">곡 데이터를 불러오는 중...</div>`;
        dropdown.style.display = 'block';
        return;
    }

    const filtered = allSongsList.filter(song => 
        song.title && song.title.toLowerCase().includes(keyword)
    );

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-item" style="color:#aaa; cursor:default;">검색 결과가 없습니다.</div>`;
    } else {
        dropdown.innerHTML = filtered.map(song => `
            <div class="dropdown-item" onclick="selectSongFromDropdown(${song.id}, '${song.title.replace(/'/g, "\\'")}')">
                <span><strong>${song.title}</strong></span>
                <span class="item-id">ID: ${song.id}</span>
            </div>
        `).join('');
    }
    dropdown.style.display = 'block';
}

function selectSongFromDropdown(songId, songTitle) {
    document.getElementById('songId').value = songId;
    document.getElementById('songTitleInput').value = songTitle;
    document.getElementById('songDropdownList').style.display = 'none';

    loadExistingRecord(songId);
}

// 드롭다운 바깥 클릭 시 닫기
document.addEventListener('click', function(e) {
    const container = document.getElementById('songTitleInput')?.parentElement;
    if (container && !container.contains(e.target)) {
        const dropdown = document.getElementById('songDropdownList');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// 사용자가 헤더를 수동으로 클릭했을 때의 정렬 처리
function sortTable(column) {
    if (currentSortColumn === column) {
        isAscending = !isAscending;
    } else {
        currentSortColumn = column;
        isAscending = true;
    }

    updateSortIcons();
    applySort(currentSortColumn, isAscending);
    renderTable(fetchedData);
}

// 4. 데이터 저장
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

    const casualStatus = document.getElementById('casualStatus').value;
    const normalStatus = document.getElementById('normalStatus').value;
    const hardStatus = document.getElementById('hardStatus').value;
    const expertStatus = document.getElementById('expertStatus').value;

    const existingRecord = fetchedData.find(item => item.song_id === targetId);

    const rowData = {
        song_id: targetId,
        casual_score: casualInput ? parseInt(casualInput) : (existingRecord ? existingRecord.casual_score : null),
        normal_score: normalInput ? parseInt(normalInput) : (existingRecord ? existingRecord.normal_score : null),
        hard_score: hardInput ? parseInt(hardInput) : (existingRecord ? existingRecord.hard_score : null),
        expert_score: expertInput ? parseInt(expertInput) : (existingRecord ? existingRecord.expert_score : null),
        casual_status: casualStatus,
        normal_status: normalStatus,
        hard_status: hardStatus,
        expert_status: expertStatus
    };

    const { error: recordError } = await supabaseClient
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (recordError) {
        alert('점수 저장 실패: ' + recordError.message);
    } else {
        alert('기록과 클리어 상태가 성공적으로 반영되었습니다!');
        await loadRecords();
    }
}

// 📊 레벨 1~19 통계 계산 및 렌더링 함수
function renderStatsTable() {
    const statsBody = document.getElementById('statsTableBody');
    if (!statsBody) return;
    statsBody.innerHTML = '';

    const stats = Array.from({ length: 20 }, () => ({
        total: 0, applus: 0, ap: 0, fc: 0, clear: 0
    }));

    const totalStats = { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 };

    fetchedData.forEach(item => {
        const song = item.songs;
        if (!song) return;

        const difficulties = [
            { score: item.casual_score, status: item.casual_status, level: song.casual_level },
            { score: item.normal_score, status: item.normal_status, level: song.normal_level },
            { score: item.hard_score, status: item.hard_status, level: song.hard_level },
            { score: item.expert_score, status: item.expert_status, level: song.expert_level }
        ];

        difficulties.forEach(diff => {
            if (diff.score !== null && diff.score !== undefined && diff.level >= 1 && diff.level <= 19) {
                const lv = diff.level;
                stats[lv].total += 1;
                totalStats.total += 1;

                if (diff.status === 'AP+') {
                    stats[lv].applus += 1; stats[lv].ap += 1; stats[lv].fc += 1; stats[lv].clear += 1;
                    totalStats.applus += 1; totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (diff.status === 'AP') {
                    stats[lv].ap += 1; stats[lv].fc += 1; stats[lv].clear += 1;
                    totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (diff.status === 'FC') {
                    stats[lv].fc += 1; stats[lv].clear += 1;
                    totalStats.fc += 1; totalStats.clear += 1;
                } else {
                    stats[lv].clear += 1;
                    totalStats.clear += 1;
                }
            }
        });
    });

    const getRateStr = (count, total) => {
        if (total === 0) return '(0.0%)';
        return `(${(count / total * 100).toFixed(1)}%)`;
    };

    for (let lv = 1; lv <= 19; lv++) {
        const row = stats[lv];
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="font-weight: bold; color: #333;">Level ${lv}</td>
            <td><span class="stats-count status-applus">${row.applus}</span><span class="stats-rate">${getRateStr(row.applus, row.total)}</span></td>
            <td><span class="stats-count status-ap">${row.ap}</span><span class="stats-rate">${getRateStr(row.ap, row.total)}</span></td>
            <td><span class="stats-count status-fc">${row.fc}</span><span class="stats-rate">${getRateStr(row.fc, row.total)}</span></td>
            <td><span class="stats-count status-clear">${row.clear}</span><span class="stats-rate">${getRateStr(row.clear, row.total)}</span></td>
        `;
        statsBody.appendChild(tr);
    }

    const totalTr = document.createElement('tr');
    totalTr.className = 'total-row';
    totalTr.innerHTML = `
        <td>TOTAL</td>
        <td><span class="status-applus">${totalStats.applus}</span><span class="stats-rate">${getRateStr(totalStats.applus, totalStats.total)}</span></td>
        <td><span class="status-ap">${totalStats.ap}</span><span class="stats-rate">${getRateStr(totalStats.ap, totalStats.total)}</span></td>
        <td><span class="status-fc">${totalStats.fc}</span><span class="stats-rate">${getRateStr(totalStats.fc, totalStats.total)}</span></td>
        <td><span class="status-clear">${totalStats.clear}</span><span class="stats-rate">${getRateStr(totalStats.clear, totalStats.total)}</span></td>
    `;
    statsBody.appendChild(totalTr);

    const songCount = allSongsList.length;
    const chartCount = songCount * 4;

    const statsSummary = document.getElementById('statsSummary');
    if (statsSummary) {
        statsSummary.innerHTML = `총 <strong>${songCount}</strong>곡 (<strong>${chartCount}</strong>개 채보)`;
    }
}