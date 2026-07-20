const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];
// [기본 정렬 설정] 최초 로드 시 '곡 제목' 기준으로 오름차순 정렬하기 위한 기본값 설정
let currentSortColumn = 'title'; 
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
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
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
                expert_notes
            )
        `);

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">오류 발생: ${error.message}</td></tr>`;
        return;
    }

    fetchedData = data || [];

    // [수정] 무조건 'title'로 초기화하지 않고, '현재 활성화된 정렬 기준'을 그대로 유지하여 정렬을 수행합니다.
    applySort(currentSortColumn, isAscending);

    // 정렬 삼각형 아이콘 UI 상태 업데이트
    updateSortIcons();

    renderTable(fetchedData);
    updateSongTitleDisplay();
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

// 점수와 클리어 상태, 해당 난이도의 총 노트수를 받아 렌더링하는 함수 (AP 전용 차감 계산 적용)
function getScoreHTML(score, status, totalNotes) {
    if (score === null || score === undefined) return '<span style="color:#aaa">-</span>';
    
    let styleClass = 'status-clear';
    let badgeHTML = '';
    let missedText = ''; // AP 상태에서 Perfect+를 놓친 개수를 담을 변수

    // 💡 [수정] 오직 'AP' 상태일 때만 만점(AP+) 점수와 비교하여 틀린 개수를 계산합니다.
    if (status === 'AP' && totalNotes) {
        const maxScore = 1000000 + totalNotes; // 이 곡의 만점(AP+) 점수
        if (score < maxScore) {
            const missedCount = maxScore - score; // 만점에서 모자란 점수 = Perfect+가 아닌 일반 Perfect 판정 개수
            missedText = `<span style="font-size: 11px; color: #ff6b6b; font-weight: normal; margin-left: 4px;">(-${missedCount})</span>`;
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

    // 점수 텍스트와 계산된 개수(-명수), 뱃지를 차례대로 결합하여 반환합니다.
    return `<span class="score-text ${styleClass}">${score.toLocaleString()}</span>${missedText}${badgeHTML}`;
}

// 2. 테이블 렌더링 (곡 ID 열 제거 버전)
function renderTable(dataList) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    if (dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">등록된 데이터가 없습니다.</td></tr>'; // colspan을 6에서 5로 변경
        return;
    }

    dataList.forEach(item => {
        const song = item.songs;
        if (!song) return;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = function() { selectSong(item.song_id); };

        const l = (level) => (level !== null && level !== undefined) ? `(Lv.${level})` : '';

        // 모든 난이도가 AP+ 상태인지 확인 (곡 졸업 여부)
        const isGraduated = item.casual_status === 'AP+' && 
                            item.normal_status === 'AP+' && 
                            item.hard_status === 'AP+' && 
                            item.expert_status === 'AP+';

        const songCellClass = isGraduated ? 'song-info-cell graduated-song-cell' : 'song-info-cell';
        const masterBadge = isGraduated ? '<span class="graduated-badge">🏅 MASTER</span>' : '';

        // 💡 <td>${item.song_id}</td> 부분을 완전히 제외하고 5개의 열만 렌더링합니다.
        tr.innerHTML = `
            <td class="${songCellClass}">
                <strong class="song-title" style="display:inline-block; vertical-align:middle;">${song.title}</strong>${masterBadge}
                <span class="song-composer" style="display:block; margin-top:2px;">${song.composer || 'Unknown Composer'}</span>
            </td>
            <td class="col-casual">${getScoreHTML(item.casual_score, item.casual_status)}<br><div class="level-badge">${l(song.casual_level)}</div></td>
            <td class="col-normal">${getScoreHTML(item.normal_score, item.normal_status)}<br><div class="level-badge">${l(song.normal_level)}</div></td>
            <td class="col-hard">${getScoreHTML(item.hard_score, item.hard_status)}<br><div class="level-badge">${l(song.hard_level)}</div></td>
            <td class="col-expert">${getScoreHTML(item.expert_score, item.expert_status)}<br><div class="level-badge">${l(song.expert_level)}</div></td>
        `;
        tableBody.appendChild(tr);
    });
}

// 표에서 행 클릭 시 입력 폼에 바인딩
function selectSong(songId) {
    document.getElementById('songId').value = songId;
    updateSongTitleDisplay();
    
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
    }
    document.getElementById('songId').focus();
}

function updateSongTitleDisplay() {
    const songIdInput = document.getElementById('songId').value;
    const displayArea = document.getElementById('songTitleDisplay');
    
    if (!songIdInput) {
        displayArea.innerHTML = '<span style="color:#aaa; font-weight:normal;">곡 ID를 입력하거나 아래 표에서 곡을 선택하세요.</span>';
        return;
    }

    const targetId = parseInt(songIdInput);
    const found = fetchedData.find(item => item.song_id === targetId);

    if (found && found.songs) {
        displayArea.innerHTML = `선택된 곡: <span style="color:#2ecc71">${found.songs.title}</span>`;
    } else {
        displayArea.innerHTML = `
            <span class="new-song-badge">신규 악곡 등록 모드</span><br>
            <input type="text" id="newSongTitle" class="new-title-input" style="display:block;" placeholder="새로운 곡의 제목을 입력하세요">
        `;
    }
}

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

    if (!existingRecord) {
        const newTitleInput = document.getElementById('newSongTitle');
        const newTitle = newTitleInput ? newTitleInput.value.trim() : '';
        if (!newTitle) {
            alert('새로운 곡의 ID입니다. 악곡 제목을 입력해주세요.');
            if(newTitleInput) newTitleInput.focus();
            return;
        }

        const { error: songError } = await supabaseClient
            .from('songs')
            .upsert([{ id: targetId, title: newTitle, composer: 'Unknown Composer' }]);

        if (songError) {
            alert('새로운 곡 등록 실패: ' + songError.message);
            return;
        }
    }

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
        loadRecords(); // [유지 확인] 사용자가 보고 있던 정렬 상태 그대로 유지하면서 갱신됩니다.
    }
}

// 📊 레벨 1~19 통계 계산 및 렌더링 함수
function renderStatsTable() {
    const statsBody = document.getElementById('statsTableBody');
    if (!statsBody) return;
    statsBody.innerHTML = '';

    // 레벨 1부터 19까지 데이터를 모을 배열 초기화 (0번 인덱스는 비워둠)
    const stats = Array.from({ length: 20 }, () => ({
        total: 0, applus: 0, ap: 0, fc: 0, clear: 0
    }));

    // 전체 합계를 위한 객체
    const totalStats = { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 };

    // 1. 데이터 집계
    fetchedData.forEach(item => {
        const song = item.songs;
        if (!song) return;

        // 4가지 난이도 각각 매핑 검사
        const difficulties = [
            { score: item.casual_score, status: item.casual_status, level: song.casual_level },
            { score: item.normal_score, status: item.normal_status, level: song.normal_level },
            { score: item.hard_score, status: item.hard_status, level: song.hard_level },
            { score: item.expert_score, status: item.expert_status, level: song.expert_level }
        ];

        difficulties.forEach(diff => {
            // 점수가 기록되어 있고 레벨이 1~19 사이인 경우에만 집계
            if (diff.score !== null && diff.score !== undefined && diff.level >= 1 && diff.level <= 19) {
                const lv = diff.level;
                stats[lv].total += 1;
                totalStats.total += 1;

                // 상위 등급이 하위 등급의 조건을 포함하여 누적 카운트 처리
                if (diff.status === 'AP+') {
                    stats[lv].applus += 1;
                    stats[lv].ap += 1;
                    stats[lv].fc += 1;
                    stats[lv].clear += 1;

                    totalStats.applus += 1;
                    totalStats.ap += 1;
                    totalStats.fc += 1;
                    totalStats.clear += 1;
                } else if (diff.status === 'AP') {
                    stats[lv].ap += 1;
                    stats[lv].fc += 1;
                    stats[lv].clear += 1;

                    totalStats.ap += 1;
                    totalStats.fc += 1;
                    totalStats.clear += 1;
                } else if (diff.status === 'FC') {
                    stats[lv].fc += 1;
                    stats[lv].clear += 1;

                    totalStats.fc += 1;
                    totalStats.clear += 1;
                } else {
                    // CLEAR인 경우
                    stats[lv].clear += 1;
                    totalStats.clear += 1;
                }
            }
        });
    });

    // 비율 구하기 헬퍼 함수
    const getRateStr = (count, total) => {
        if (total === 0) return '(0.0%)';
        return `(${(count / total * 100).toFixed(1)}%)`;
    };

    // 2. 레벨 1~19 행 생성 및 렌더링
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

    // 3. 맨 아래 TOTAL 행 추가
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
}