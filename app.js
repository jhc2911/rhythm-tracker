// 본인의 Supabase 프로젝트 정보
const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

// 💡 변수명을 supabase 대신 supabaseClient로 변경하여 충돌을 막습니다.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.onload = function() {
    loadRecords();
};

// 1. 데이터 불러오기
async function loadRecords() {
    const tableBody = document.getElementById('tableBody');
    
    // 💡 아래 기존 코드에서 supabase.from을 supabaseClient.from으로 수정합니다.
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

// (중략 - renderTable 및 sortTable 함수는 기존과 동일하므로 생략)

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

    // 💡 이곳의 supabase.from도 supabaseClient.from으로 수정합니다.
    const { error } = await supabaseClient
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (error) {
        alert('저장 실패: ' + error.message);
    } else {
        alert('기록이 성공적으로 반영되었습니다!');
        loadRecords();
    }
}