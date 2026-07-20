// 본인의 Supabase 프로젝트 정보
const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let fetchedData = [];
let currentSortColumn = '';
let isAscending = true;

window.onload = function() {
    loadRecords();
};

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
        // 마우스 커서를 올리면 포인터로 변하게 하고, 클릭 시 상단 폼에 ID 입력 함수 호출
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

// 💡 표에서 곡을 클릭하면 상단 입력창에 ID를 채워주는 편의 기능
function selectSong(songId) {
    document.getElementById('songId').value = songId;
    // 시각적 효과를 위해 입력창으로 포커스 이동
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

// 4. 데이터 저장 및 안전한 수정 (Safe Update)
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

    // 💡 기존에 저장되어 있던 이 곡의 데이터를 전역 변수에서 찾습니다.
    const existingRecord = fetchedData.find(item => item.song_id === parseInt(songId));

    // 입력창이 비어있으면 기존 점수를 유지하고, 입력창에 값이 있을 때만 새 점수를 적용합니다.
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
        
        // 입력창 비우기
        document.getElementById('songId').value = '';
        document.getElementById('casualScore').value = '';
        document.getElementById('normalScore').value = '';
        document.getElementById('hardScore').value = '';
        document.getElementById('expertScore').value = '';
        
        loadRecords();
    }
}