const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];          // 유저의 플레이 기록 (records 테이블)
let allSongsList = [];         // 전체 곡 목록 (songs 테이블)
let selectedLevelFilter = null; // 🎯 레벨 필터 상태
let selectedPackFilter = null;  // 📦 앨범 필터 상태
let selectedDiffFilter = null;  // 🎯 난이도 필터 상태 ('CASUAL', 'NORMAL', 'HARD', 'EXPERT', null)
let selectedStatusFilter = null; // 🏆 클리어 상태 필터 ('AP+', 'AP', 'FC', 'CLEAR', 'ALL', null)
let isNegativeFilter = false;   // 🚨 false: 달성한 곡 / true: 미달성(NOT) 곡 필터링

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

// 0. 전체 songs 데이터 로드
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
    applyCurrentFilterAndRender(); // 필터 적용 후 테이블 출력
    renderStatsTable();     // 레벨별 통계 출력
    renderDiffStatsTable(); // 🎯 난이도별 통계 출력
    renderPackStatsTable(); // 앨범별 통계 출력
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

// 정렬 상태 아이콘 업데이트
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

// 총점 및 평균 점수 요약 계산 및 렌더링
function renderScoreSummary() {
    const totalScoreElem = document.getElementById('totalScoreText');
    const avgScoreElem = document.getElementById('avgScoreText');
    if (!totalScoreElem || !avgScoreElem) return;

    let grandTotalScore = 0;
    let totalNotesCount = 0;

    fetchedData.forEach(item => {
        ['casual_score', 'normal_score', 'hard_score', 'expert_score'].forEach(key => {
            if (item[key] !== null && item[key] !== undefined) {
                grandTotalScore += parseInt(item[key]);
            }
        });
    });

    allSongsList.forEach(song => {
        totalNotesCount += (song.casual_notes || 0) +
                           (song.normal_notes || 0) +
                           (song.hard_notes || 0) +
                           (song.expert_notes || 0);
    });

    const totalChartCount = allSongsList.length * 4;
    const baseScore = totalChartCount * 1000000;
    const maxTheoreticalScore = baseScore + totalNotesCount;

    let avgPercentageStr = '0.00%';
    let maxPercentageStr = '100.00%';

    if (baseScore > 0) {
        const rawAvgPct = (grandTotalScore / baseScore) * 100;
        const roundedAvgPct = (Math.ceil(rawAvgPct * 100) / 100).toFixed(2);
        avgPercentageStr = `${roundedAvgPct}%`;

        const rawMaxPct = (maxTheoreticalScore / baseScore) * 100;
        const roundedMaxPct = (Math.ceil(rawMaxPct * 100) / 100).toFixed(2);
        maxPercentageStr = `${roundedMaxPct}%`;
    }

    totalScoreElem.innerText = `${grandTotalScore.toLocaleString()} / ${maxTheoreticalScore.toLocaleString()}`;
    avgScoreElem.innerText = `${avgPercentageStr} / ${maxPercentageStr}`;
}

// 🎯 클리어 상태 조건 판별 헬퍼 함수
function isStatusMatched(status, requiredStatus, isNegative = false) {
    if (!requiredStatus || requiredStatus === 'ALL') return true;

    let isMatch = false;

    if (requiredStatus === 'AP+') {
        isMatch = (status === 'AP+');
    } else if (requiredStatus === 'AP') {
        isMatch = (status === 'AP+' || status === 'AP');
    } else if (requiredStatus === 'FC') {
        isMatch = (status === 'AP+' || status === 'AP' || status === 'FC');
    } else if (requiredStatus === 'CLEAR') {
        isMatch = (status && status !== 'NONE' && status !== 'FAILED');
    }

    return isNegative ? !isMatch : isMatch;
}

// 🎯 필터링 처리 및 테이블 렌더링 연결 함수
function applyCurrentFilterAndRender() {
    let displayList = fetchedData;

    // 1. 레벨 & 클리어 상태 교차 필터링
    if (selectedLevelFilter !== null) {
        const targetLv = parseInt(selectedLevelFilter);
        displayList = displayList.filter(item => {
            const song = item.songs;
            if (!song) return false;

            const diffs = [
                { status: item.casual_status, level: song.casual_level },
                { status: item.normal_status, level: song.normal_level },
                { status: item.hard_status, level: song.hard_level },
                { status: item.expert_status, level: song.expert_level }
            ];

            return diffs.some(d => 
                Number(d.level) === targetLv && 
                isStatusMatched(d.status, selectedStatusFilter, isNegativeFilter)
            );
        });
    }

    // 2. 앨범 & 클리어 상태 교차 필터링
    if (selectedPackFilter !== null) {
        displayList = displayList.filter(item => {
            const song = item.songs;
            if (!song) return false;
            const packName = song.pack_name || 'TRACING THE STARS';
            if (packName !== selectedPackFilter) return false;

            if (!selectedStatusFilter || selectedStatusFilter === 'ALL') return true;

            const statuses = [item.casual_status, item.normal_status, item.hard_status, item.expert_status];
            return statuses.some(st => isStatusMatched(st, selectedStatusFilter, isNegativeFilter));
        });
    }

    // 3. 난이도 & 클리어 상태 교차 필터링
    if (selectedDiffFilter !== null) {
        const diffKeyMap = {
            'CASUAL': 'casual_status',
            'NORMAL': 'normal_status',
            'HARD': 'hard_status',
            'EXPERT': 'expert_status'
        };
        const statusKey = diffKeyMap[selectedDiffFilter];

        displayList = displayList.filter(item => {
            if (!statusKey) return false;
            return isStatusMatched(item[statusKey], selectedStatusFilter, isNegativeFilter);
        });
    }

    // 4. 단독 TOTAL 행 클리어 상태 필터링
    if (selectedLevelFilter === null && selectedPackFilter === null && selectedDiffFilter === null && selectedStatusFilter) {
        displayList = displayList.filter(item => {
            const statuses = [item.casual_status, item.normal_status, item.hard_status, item.expert_status];
            return statuses.some(st => isStatusMatched(st, selectedStatusFilter, isNegativeFilter));
        });
    }

    renderTable(displayList);
}

// 📱 🎯 [수정] 통합 셀 필터링 제어 함수 (PC 우클릭 + 모바일 롱 프레스 지원)
function filterCell(e, type, categoryValue, statusType, forceNegative = null) {
    if (e && e.cancelable && e.type === 'contextmenu') {
        e.preventDefault();
    }

    // 롱 프레스 등으로 forceNegative가 전달되면 우선 적용, 아닐 경우 PC 마우스/키 조합 판별
    let wantNegative = false;
    if (forceNegative !== null) {
        wantNegative = forceNegative;
    } else if (e) {
        wantNegative = (e.button === 2 || e.shiftKey || e.altKey);
    }

    const isSameLevel = (type === 'level' && selectedLevelFilter === categoryValue && selectedStatusFilter === statusType && isNegativeFilter === wantNegative);
    const isSamePack = (type === 'pack' && selectedPackFilter === categoryValue && selectedStatusFilter === statusType && isNegativeFilter === wantNegative);
    const isSameDiff = (type === 'diff' && selectedDiffFilter === categoryValue && selectedStatusFilter === statusType && isNegativeFilter === wantNegative);

    if (isSameLevel || isSamePack || isSameDiff) {
        selectedLevelFilter = null;
        selectedPackFilter = null;
        selectedDiffFilter = null;
        selectedStatusFilter = null;
        isNegativeFilter = false;
    } else {
        selectedStatusFilter = statusType;
        isNegativeFilter = wantNegative;

        selectedLevelFilter = (type === 'level') ? categoryValue : null;
        selectedPackFilter = (type === 'pack') ? categoryValue : null;
        selectedDiffFilter = (type === 'diff') ? categoryValue : null;
    }

    renderStatsTable();
    renderDiffStatsTable();
    renderPackStatsTable();
    applyCurrentFilterAndRender();

    const summaryElem = document.getElementById('scoreSummaryContainer') || document.getElementById('tableBody');
    if (summaryElem) {
        summaryElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 📱 모바일 롱 프레스(길게 누르기) 및 터치 잔상 방지 바인딩 헬퍼 함수
function attachTouchAndClickEvents(element, type, categoryValue, statusType) {
    let touchTimer = null;
    let isLongPress = false;
    let longPressTriggered = false; // 롱 프레스 실행 여부 플래그

    // 터치 시작 (0.5초 누르면 미달성 필터 동작)
    element.addEventListener('touchstart', (e) => {
        isLongPress = false;
        longPressTriggered = false;

        touchTimer = setTimeout(() => {
            isLongPress = true;
            longPressTriggered = true;
            
            // 모바일 롱 프레스에 의한 텍스트 드래그/선택 및 기본 팝업 방지
            if (e.cancelable) e.preventDefault();
            
            // 미달성 필터링 실행
            filterCell(e, type, categoryValue, statusType, true); // forceNegative = true
        }, 500);
    }, { passive: false });

    // 손가락을 뗄 때 롱 프레스 직후의 터치 잔상 이벤트 차단
    element.addEventListener('touchend', (e) => {
        if (touchTimer) clearTimeout(touchTimer);

        if (longPressTriggered) {
            // 롱 프레스가 동작한 후 발생한 touchend의 기본 동작(클릭 발생)을 차단
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            
            // 잔상 클릭 방지를 위해 잠시 후 플래그 해제
            setTimeout(() => {
                longPressTriggered = false;
                isLongPress = false;
            }, 300);
        }
    }, { passive: false });

    // 드래그/스크롤 이동 시 롱 프레스 타이머 취소
    element.addEventListener('touchmove', () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    // PC 및 일반 터치 클릭 이벤트 처리
    element.addEventListener('click', (e) => {
        if (isLongPress || longPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        filterCell(e, type, categoryValue, statusType, false);
    });

    // PC 마우스 우클릭 (contextmenu)
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        filterCell(e, type, categoryValue, statusType, true);
    });
}

function filterByLevel(level) { filterCell(null, 'level', level, null); }
function filterByPack(packName) { filterCell(null, 'pack', packName, null); }

// 2. 메인 레코드 테이블 렌더링
function renderTable(dataList) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (dataList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #888;">해당 조건에 일치하는 기록이 없습니다.</td></tr>';
        renderScoreSummary();
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
            
            const isHighlighted = selectedLevelFilter !== null && Number(level) === Number(selectedLevelFilter);
            const style = isHighlighted
                ? 'font-size: 11px; color: #ff3333; font-weight: bold; margin-top: 3px; text-align: center; width: 100%;'
                : 'font-size: 11px; color: #888; margin-top: 3px; text-align: center; width: 100%;';

            return `
                <div style="${style}">
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

    renderScoreSummary();
}

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

function selectSong(songId) {
    const songIdInput = document.getElementById('songId');
    const titleInput = document.getElementById('songTitleInput');
    
    songIdInput.value = songId;
    
    const foundSong = allSongsList.find(s => Number(s.id) === Number(songId));
    if (foundSong && titleInput) {
        titleInput.value = foundSong.title;
    }

    loadExistingRecord(songId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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

function showSongDropdown() { filterSongDropdown(); }

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

    if (!keyword) {
        renderDropdownItems(allSongsList);
        return;
    }

    const filtered = allSongsList.filter(song => 
        song.title && song.title.toLowerCase().startsWith(keyword)
    );

    renderDropdownItems(filtered);
}

function renderDropdownItems(list) {
    const dropdown = document.getElementById('songDropdownList');
    
    if (list.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-item" style="color:#aaa; cursor:default;">검색 결과가 없습니다.</div>`;
    } else {
        dropdown.innerHTML = list.map(song => `
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

document.addEventListener('click', function(e) {
    const container = document.getElementById('songTitleInput')?.parentElement;
    if (container && !container.contains(e.target)) {
        const dropdown = document.getElementById('songDropdownList');
        if (dropdown) dropdown.style.display = 'none';
    }
});

function sortTable(column) {
    if (currentSortColumn === column) {
        isAscending = !isAscending;
    } else {
        currentSortColumn = column;
        isAscending = true;
    }

    updateSortIcons();
    applySort(currentSortColumn, isAscending);
    applyCurrentFilterAndRender();
}

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

// 📊 [수정] 레벨 1~19 통계 계산 및 렌더링 함수 (터치/롱프레스 지원)
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

    const isCellSelected = (type, val, status) => {
        if (type === 'level' && selectedLevelFilter === val && selectedStatusFilter === status) {
            return isNegativeFilter ? 'selected-cell-negative' : 'selected-cell-highlight';
        }
        return '';
    };

    for (let lv = 1; lv <= 19; lv++) {
        const row = stats[lv];
        const tr = document.createElement('tr');
        tr.id = `stats-row-lv-${lv}`;

        const createTd = (type, categoryVal, statusType, contentHtml, extraClass = '') => {
            const td = document.createElement('td');
            td.style.cursor = 'pointer';
            if (extraClass) td.className = extraClass;
            td.innerHTML = contentHtml;
            attachTouchAndClickEvents(td, type, categoryVal, statusType);
            return td;
        };

        const tdLabel = createTd('level', lv, null, `Level ${lv}`);
        tdLabel.style.fontWeight = 'bold';
        tdLabel.style.color = '#333';
        tdLabel.style.textDecoration = 'underline';

        tr.appendChild(tdLabel);
        tr.appendChild(createTd('level', lv, 'AP+', `<span class="stats-count status-applus">${row.applus}</span><span class="stats-rate">${getRateStr(row.applus, row.total)}</span>`, isCellSelected('level', lv, 'AP+')));
        tr.appendChild(createTd('level', lv, 'AP', `<span class="stats-count status-ap">${row.ap}</span><span class="stats-rate">${getRateStr(row.ap, row.total)}</span>`, isCellSelected('level', lv, 'AP')));
        tr.appendChild(createTd('level', lv, 'FC', `<span class="stats-count status-fc">${row.fc}</span><span class="stats-rate">${getRateStr(row.fc, row.total)}</span>`, isCellSelected('level', lv, 'FC')));
        tr.appendChild(createTd('level', lv, 'CLEAR', `<span class="stats-count status-clear">${row.clear}</span><span class="stats-rate">${getRateStr(row.clear, row.total)}</span>`, isCellSelected('level', lv, 'CLEAR')));

        statsBody.appendChild(tr);
    }

    // TOTAL 행 생성
    const totalTr = document.createElement('tr');
    totalTr.id = 'stats-row-total';
    totalTr.className = 'total-row';

    const createTotalTd = (type, statusType, contentHtml, extraClass = '') => {
        const td = document.createElement('td');
        td.style.cursor = 'pointer';
        if (extraClass) td.className = extraClass;
        td.innerHTML = contentHtml;
        attachTouchAndClickEvents(td, type, null, statusType);
        return td;
    };

    const tdTotalLabel = createTotalTd('level', null, 'TOTAL');
    tdTotalLabel.style.textDecoration = 'underline';

    totalTr.appendChild(tdTotalLabel);
    totalTr.appendChild(createTotalTd('level', 'AP+', `<span class="status-applus">${totalStats.applus}</span><span class="stats-rate">${getRateStr(totalStats.applus, totalStats.total)}</span>`, isCellSelected('level', null, 'AP+')));
    totalTr.appendChild(createTotalTd('level', 'AP', `<span class="status-ap">${totalStats.ap}</span><span class="stats-rate">${getRateStr(totalStats.ap, totalStats.total)}</span>`, isCellSelected('level', null, 'AP')));
    totalTr.appendChild(createTotalTd('level', 'FC', `<span class="status-fc">${totalStats.fc}</span><span class="stats-rate">${getRateStr(totalStats.fc, totalStats.total)}</span>`, isCellSelected('level', null, 'FC')));
    totalTr.appendChild(createTotalTd('level', 'CLEAR', `<span class="status-clear">${totalStats.clear}</span><span class="stats-rate">${getRateStr(totalStats.clear, totalStats.total)}</span>`, isCellSelected('level', null, 'CLEAR')));

    statsBody.appendChild(totalTr);

    const songCount = allSongsList.length;
    const chartCount = songCount * 4;

    const statsSummary = document.getElementById('statsSummary');
    if (statsSummary) {
        statsSummary.innerHTML = `총 <strong>${songCount}</strong>곡 (<strong>${chartCount}</strong>개 채보)`;
    }
}

// 🎯 [수정] 난이도별 통계 계산 및 렌더링 함수
function renderDiffStatsTable() {
    const diffBody = document.getElementById('diffStatsTableBody');
    if (!diffBody) return;
    diffBody.innerHTML = '';

    const diffNames = ['CASUAL', 'NORMAL', 'HARD', 'EXPERT'];
    const diffStats = {
        'CASUAL': { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 },
        'NORMAL': { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 },
        'HARD':   { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 },
        'EXPERT': { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 }
    };

    const totalStats = { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 };

    fetchedData.forEach(item => {
        const diffs = [
            { key: 'CASUAL', score: item.casual_score, status: item.casual_status },
            { key: 'NORMAL', score: item.normal_score, status: item.normal_status },
            { key: 'HARD',   score: item.hard_score,   status: item.hard_status },
            { key: 'EXPERT', score: item.expert_score, status: item.expert_status }
        ];

        diffs.forEach(d => {
            if (d.score !== null && d.score !== undefined) {
                const target = diffStats[d.key];
                target.total += 1;
                totalStats.total += 1;

                if (d.status === 'AP+') {
                    target.applus += 1; target.ap += 1; target.fc += 1; target.clear += 1;
                    totalStats.applus += 1; totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (d.status === 'AP') {
                    target.ap += 1; target.fc += 1; target.clear += 1;
                    totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (d.status === 'FC') {
                    target.fc += 1; target.clear += 1;
                    totalStats.fc += 1; totalStats.clear += 1;
                } else {
                    target.clear += 1;
                    totalStats.clear += 1;
                }
            }
        });
    });

    const getRateStr = (count, total) => {
        if (total === 0) return '(0.0%)';
        return `(${(count / total * 100).toFixed(1)}%)`;
    };

    const isCellSelected = (type, val, status) => {
        if (type === 'diff' && selectedDiffFilter === val && selectedStatusFilter === status) {
            return isNegativeFilter ? 'selected-cell-negative' : 'selected-cell-highlight';
        }
        return '';
    };

    const createTd = (type, categoryVal, statusType, contentHtml, extraClass = '') => {
        const td = document.createElement('td');
        td.style.cursor = 'pointer';
        if (extraClass) td.className = extraClass;
        td.innerHTML = contentHtml;
        attachTouchAndClickEvents(td, type, categoryVal, statusType);
        return td;
    };

    diffNames.forEach(diffName => {
        const row = diffStats[diffName];
        const tr = document.createElement('tr');

        const tdLabel = createTd('diff', diffName, null, diffName);
        tdLabel.style.fontWeight = 'bold';
        tdLabel.style.color = '#333';
        tdLabel.style.textDecoration = 'underline';

        tr.appendChild(tdLabel);
        tr.appendChild(createTd('diff', diffName, 'AP+', `<span class="stats-count status-applus">${row.applus}</span><span class="stats-rate">${getRateStr(row.applus, row.total)}</span>`, isCellSelected('diff', diffName, 'AP+')));
        tr.appendChild(createTd('diff', diffName, 'AP', `<span class="stats-count status-ap">${row.ap}</span><span class="stats-rate">${getRateStr(row.ap, row.total)}</span>`, isCellSelected('diff', diffName, 'AP')));
        tr.appendChild(createTd('diff', diffName, 'FC', `<span class="stats-count status-fc">${row.fc}</span><span class="stats-rate">${getRateStr(row.fc, row.total)}</span>`, isCellSelected('diff', diffName, 'FC')));
        tr.appendChild(createTd('diff', diffName, 'CLEAR', `<span class="stats-count status-clear">${row.clear}</span><span class="stats-rate">${getRateStr(row.clear, row.total)}</span>`, isCellSelected('diff', diffName, 'CLEAR')));

        diffBody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.className = 'total-row';

    const tdTotalLabel = createTd('diff', null, null, 'TOTAL');
    tdTotalLabel.style.textDecoration = 'underline';

    totalTr.appendChild(tdTotalLabel);
    totalTr.appendChild(createTd('diff', null, 'AP+', `<span class="status-applus">${totalStats.applus}</span><span class="stats-rate">${getRateStr(totalStats.applus, totalStats.total)}</span>`, isCellSelected('diff', null, 'AP+')));
    totalTr.appendChild(createTd('diff', null, 'AP', `<span class="status-ap">${totalStats.ap}</span><span class="stats-rate">${getRateStr(totalStats.ap, totalStats.total)}</span>`, isCellSelected('diff', null, 'AP')));
    totalTr.appendChild(createTd('diff', null, 'FC', `<span class="status-fc">${totalStats.fc}</span><span class="stats-rate">${getRateStr(totalStats.fc, totalStats.total)}</span>`, isCellSelected('diff', null, 'FC')));
    totalTr.appendChild(createTd('diff', null, 'CLEAR', `<span class="status-clear">${totalStats.clear}</span><span class="stats-rate">${getRateStr(totalStats.clear, totalStats.total)}</span>`, isCellSelected('diff', null, 'CLEAR')));

    diffBody.appendChild(totalTr);
}

// 📦 [수정] 앨범별 통계 계산 및 렌더링 함수
function renderPackStatsTable() {
    const packBody = document.getElementById('packStatsTableBody');
    if (!packBody) return;
    packBody.innerHTML = '';

    const packStatsMap = {};
    const totalStats = { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 };

    fetchedData.forEach(item => {
        const song = item.songs;
        if (!song) return;

        const packName = song.pack_name || 'TRACING THE STARS';

        if (!packStatsMap[packName]) {
            packStatsMap[packName] = { total: 0, applus: 0, ap: 0, fc: 0, clear: 0 };
        }

        const difficulties = [
            { score: item.casual_score, status: item.casual_status, level: song.casual_level },
            { score: item.normal_score, status: item.normal_status, level: song.normal_level },
            { score: item.hard_score, status: item.hard_status, level: song.hard_level },
            { score: item.expert_score, status: item.expert_status, level: song.expert_level }
        ];

        difficulties.forEach(diff => {
            if (diff.score !== null && diff.score !== undefined && diff.level) {
                packStatsMap[packName].total += 1;
                totalStats.total += 1;

                if (diff.status === 'AP+') {
                    packStatsMap[packName].applus += 1; packStatsMap[packName].ap += 1; packStatsMap[packName].fc += 1; packStatsMap[packName].clear += 1;
                    totalStats.applus += 1; totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (diff.status === 'AP') {
                    packStatsMap[packName].ap += 1; packStatsMap[packName].fc += 1; packStatsMap[packName].clear += 1;
                    totalStats.ap += 1; totalStats.fc += 1; totalStats.clear += 1;
                } else if (diff.status === 'FC') {
                    packStatsMap[packName].fc += 1; packStatsMap[packName].clear += 1;
                    totalStats.fc += 1; totalStats.clear += 1;
                } else {
                    packStatsMap[packName].clear += 1;
                    totalStats.clear += 1;
                }
            }
        });
    });

    const getRateStr = (count, total) => {
        if (total === 0) return '(0.0%)';
        return `(${(count / total * 100).toFixed(1)}%)`;
    };

    const isCellSelected = (type, val, status) => {
        if (type === 'pack' && selectedPackFilter === val && selectedStatusFilter === status) {
            return isNegativeFilter ? 'selected-cell-negative' : 'selected-cell-highlight';
        }
        return '';
    };

    const createTd = (type, categoryVal, statusType, contentHtml, extraClass = '') => {
        const td = document.createElement('td');
        td.style.cursor = 'pointer';
        if (extraClass) td.className = extraClass;
        td.innerHTML = contentHtml;
        attachTouchAndClickEvents(td, type, categoryVal, statusType);
        return td;
    };

    const packOrder = [
        'TRACING THE STARS',
        'T.T.S. EXTENSION PACK V.1',
        'T.T.S. SUMMER PACK V.1'
    ];

    const sortedPacks = Object.keys(packStatsMap).sort((a, b) => {
        let indexA = packOrder.indexOf(a);
        let indexB = packOrder.indexOf(b);

        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;

        return indexA - indexB;
    });

    sortedPacks.forEach(packName => {
        const row = packStatsMap[packName];
        const tr = document.createElement('tr');

        const tdLabel = createTd('pack', packName, null, packName);
        tdLabel.style.fontWeight = 'bold';
        tdLabel.style.color = '#333';
        tdLabel.style.textDecoration = 'underline';

        tr.appendChild(tdLabel);
        tr.appendChild(createTd('pack', packName, 'AP+', `<span class="stats-count status-applus">${row.applus}</span><span class="stats-rate">${getRateStr(row.applus, row.total)}</span>`, isCellSelected('pack', packName, 'AP+')));
        tr.appendChild(createTd('pack', packName, 'AP', `<span class="stats-count status-ap">${row.ap}</span><span class="stats-rate">${getRateStr(row.ap, row.total)}</span>`, isCellSelected('pack', packName, 'AP')));
        tr.appendChild(createTd('pack', packName, 'FC', `<span class="stats-count status-fc">${row.fc}</span><span class="stats-rate">${getRateStr(row.fc, row.total)}</span>`, isCellSelected('pack', packName, 'FC')));
        tr.appendChild(createTd('pack', packName, 'CLEAR', `<span class="stats-count status-clear">${row.clear}</span><span class="stats-rate">${getRateStr(row.clear, row.total)}</span>`, isCellSelected('pack', packName, 'CLEAR')));

        packBody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.className = 'total-row';

    const tdTotalLabel = createTd('pack', null, null, 'TOTAL');
    tdTotalLabel.style.textDecoration = 'underline';

    totalTr.appendChild(tdTotalLabel);
    totalTr.appendChild(createTd('pack', null, 'AP+', `<span class="status-applus">${totalStats.applus}</span><span class="stats-rate">${getRateStr(totalStats.applus, totalStats.total)}</span>`, isCellSelected('pack', null, 'AP+')));
    totalTr.appendChild(createTd('pack', null, 'AP', `<span class="status-ap">${totalStats.ap}</span><span class="stats-rate">${getRateStr(totalStats.ap, totalStats.total)}</span>`, isCellSelected('pack', null, 'AP')));
    totalTr.appendChild(createTd('pack', null, 'FC', `<span class="status-fc">${totalStats.fc}</span><span class="stats-rate">${getRateStr(totalStats.fc, totalStats.total)}</span>`, isCellSelected('pack', null, 'FC')));
    totalTr.appendChild(createTd('pack', null, 'CLEAR', `<span class="status-clear">${totalStats.clear}</span><span class="stats-rate">${getRateStr(totalStats.clear, totalStats.total)}</span>`, isCellSelected('pack', null, 'CLEAR')));

    packBody.appendChild(totalTr);
}

// 다크모드 관리
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const toggleBtn = document.getElementById('themeToggleBtn');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (toggleBtn) toggleBtn.innerText = '☀️ 라이트모드';
    }
});

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    const toggleBtn = document.getElementById('themeToggleBtn');

    if (isDark) {
        localStorage.setItem('theme', 'dark');
        if (toggleBtn) toggleBtn.innerText = '☀️ 라이트모드';
    } else {
        localStorage.setItem('theme', 'light');
        if (toggleBtn) toggleBtn.innerText = '🌙 다크모드';
    }
}