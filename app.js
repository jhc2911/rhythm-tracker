// 본인의 Supabase 프로젝트 정보로 반드시 변경하세요! (https:// 와 .supabase.co 확인)
const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 불러온 데이터를 저장할 전역 변수 및 정렬 상태 기억 변수
let fetchedData = [];
let currentSortColumn = '';
let isAscending = true;

window.onload = function() {
    loadRecords();
};

// 1. 데이터 불러오기
async function loadRecords() {
    const tableBody = document.getElementById('tableBody');
    
    // 두 테이블을 join하여 필요한 필드들을 가져옵니다.
    const { data, error } = await supabase
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

    // 전역 변수에 데이터 저장 후 렌더링
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

        // null 처리용 헬퍼 함수
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

// 3. 정렬 처리 함수 (클릭 시 호출)
function sortTable(column) {
    // 같은 컬럼을 연달아 누르면 차순 변경(오름차순 <-> 내림차순), 새로운 컬럼이면 오름차순 시작
    if (currentSortColumn === column) {
        isAscending = !isAscending;
    } else {
        currentSortColumn = column;
        isAscending = true;
    }

    // 아이콘 초기화 및 변경
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = '↕');
    const currentIcon = document.getElementById(`icon-${column}`);
    if (currentIcon) {
        currentIcon.innerText = isAscending ? '▲' : '▼';
    }

    // 데이터 정렬 로직
    fetchedData.sort((a, b) => {
        let valA, valB;

        // 문자열 및 중첩 구조 데이터 처리 추출
        if (column === 'title') {
            valA = a.songs ? a.songs.title : '';
            valB = b.songs ? b.songs.title : '';
            return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            // 숫자 컬럼 정렬 (song_id, casual_score 등)
            valA = a[column] || 0;
            valB = b[column] || 0;
            return isAscending ? valA - valB : valB - valA;
        }
    });

    // 정렬된 결과로 테이블 다시 그리기
    renderTable(fetchedData);
}

// 4. 데이터 저장 및 수정
async function saveRecord() {
    const songId = document.getElementById('songId').value;
    const casualScore = document.getElementById('casualScore').value;
    const normalScore = document.getElementById('normalScore').value;
    const hardScore = document.getElementById('hardScore').value;
    const expertScore = document.getElementById('expertScore').value;

    if (!songId) {
        alert('곡 ID를 입력해주세요.');
        return;
    }

    const rowData = {
        song_id: parseInt(songId),
        casual_score: casualScore ? parseInt(casualScore) : null,
        normal_score: normalScore ? parseInt(normalScore) : null,
        hard_score: hardScore ? parseInt(hardScore) : null,
        expert_score: expertScore ? parseInt(expertScore) : null
    };

    const { error } = await supabase
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (error) {
        alert('저장 실패: ' + error.message);
    } else {
        alert('기록이 성공적으로 반영되었습니다!');
        loadRecords();
    }
}