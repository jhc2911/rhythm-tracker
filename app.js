// 본인의 Supabase 설정값으로 대체하세요
const SUPABASE_URL = 'https://qpcczmuwydpwpwpskoej.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2N6bXV3eWRwd3B3cHNrb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDgzNDEsImV4cCI6MjEwMDEyNDM0MX0.qje22MHokVuAXwrISej1KDrhFbFZFYgluzYwwdoO82I';

// Supabase 클라이언트 초기화
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 페이지가 로드되면 자동으로 데이터를 불러옵니다.
window.onload = function() {
    loadRecords();
};

// 1. 기록 불러오기 (Read)
async function loadRecords() {
    const recordListDiv = document.getElementById('recordList');
    
    // records 테이블의 모든 점수와 함께, 연결된 songs 테이블의 제목, 작곡가, 레벨 데이터들을 한 번에 가져옵니다.
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
        `)
        .order('created_at', { ascending: false }); // 최근 기록이 위로 오도록 정렬

    if (error) {
        recordListDiv.innerHTML = '<p style="color:red;">데이터를 불러오는 중 오류가 발생했습니다.</p>';
        console.error(error);
        return;
    }

    if (!data || data.length === 0) {
        recordListDiv.innerHTML = '<p>등록된 플레이 기록이 없습니다. 상단에서 첫 기록을 등록해 보세요!</p>';
        return;
    }

    // 목록 비우고 새로 그리기
    recordListDiv.innerHTML = '';
    
    data.forEach(item => {
        const song = item.songs;
        if (!song) return; // 연결된 곡 정보가 없으면 패스

        const card = document.createElement('div');
        card.className = 'record-card';

        // 점수 값이 없으면(null 또는 빈 값) '-'로 표시하기 위한 함수
        const displayScore = (score) => (score !== null && score !== undefined) ? score.toLocaleString() : '-';
        // 레벨 정보 표시용 함수
        const displayLevel = (level) => (level !== null && level !== undefined) ? `Lv.${level}` : 'Lv.-';

        card.innerHTML = `
            <div class="song-title">${song.title}</div>
            <div class="song-composer">by ${song.composer || 'Unknown'} (곡 ID: ${item.song_id})</div>
            
            <table class="result-table">
                <thead>
                    <tr>
                        <th class="text-casual">Casual</th>
                        <th class="text-normal">Normal</th>
                        <th class="text-hard">Hard</th>
                        <th class="text-expert">Expert</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><small>${displayLevel(song.casual_level)}</small></td>
                        <td><small>${displayLevel(song.normal_level)}</small></td>
                        <td><small>${displayLevel(song.hard_level)}</small></td>
                        <td><small>${displayLevel(song.expert_level)}</small></td>
                    </tr>
                    <tr>
                        <td><strong>${displayScore(item.casual_score)}</strong></td>
                        <td><strong>${displayScore(item.normal_score)}</strong></td>
                        <td><strong>${displayScore(item.hard_score)}</strong></td>
                        <td><strong>${displayScore(item.expert_score)}</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
        recordListDiv.appendChild(card);
    });
}

// 2. 기록 저장 및 수정하기 (Create / Update)
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

    // 입력받은 값을 데이터베이스 규격(정수형 또는 null)에 맞게 변환합니다.
    const rowData = {
        song_id: parseInt(songId),
        casual_score: casualScore ? parseInt(casualScore) : null,
        normal_score: normalScore ? parseInt(normalScore) : null,
        hard_score: hardScore ? parseInt(hardScore) : null,
        expert_score: expertScore ? parseInt(expertScore) : null
    };

    // 꿀팁: Supabase의 upsert 기능을 쓰면, 이미 해당 곡(song_id)의 기록이 존재하면 '수정(Update)'을 하고, 없으면 '새로 저장(Insert)'을 알아서 해줍니다.
    // 단, records 테이블의 song_id 컬럼에 Unique 제약조건이 걸려있어야 정상 작동합니다. 만약 중복 저장을 허용하고 싶다면 insert를 쓰시면 됩니다.
    const { error } = await supabase
        .from('records')
        .upsert([rowData], { onConflict: 'song_id' }); 

    if (error) {
        alert('저장 실패: ' + error.message);
        console.error(error);
    } else {
        alert('기록이 성공적으로 저장되었습니다!');
        
        // 입력창 초기화
        document.getElementById('songId').value = '';
        document.getElementById('casualScore').value = '';
        document.getElementById('normalScore').value = '';
        document.getElementById('hardScore').value = '';
        document.getElementById('expertScore').value = '';
        
        // 목록 새로고침
        loadRecords();
    }
}