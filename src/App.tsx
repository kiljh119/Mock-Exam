import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Container, Typography, TextField, Button, Box, Paper, Alert, Select, MenuItem, FormControl, InputLabel, Stepper, Step, StepLabel } from '@mui/material';
import { supabase } from './supabaseClient';

interface ExamScore {
  id: number;
  exam_name: string;
  round: number;
  score: number;
  student_name: string;
  created_at: string;
}

const STUDENT_LIST = ['길준혁', '박시혁', '엄윤서', '정하승'];

function App() {
  const [scores, setScores] = useState<ExamScore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [examInfo, setExamInfo] = useState<{
    exam_name: string;
    round: number;
  }>({
    exam_name: '',
    round: 1
  });
  const [studentScores, setStudentScores] = useState<{ [key: string]: number | '' }>({});
  const [password, setPassword] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<{ [key: string]: boolean }>(
    STUDENT_LIST.reduce((acc, student) => ({ ...acc, [student]: true }), {})
  );

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_scores')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching scores:', error);
        setError('성적을 불러오는 중 오류가 발생했습니다.');
      } else {
        console.log('Fetched scores:', data);
        setScores(data || []);
        setError(null);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('예기치 않은 오류가 발생했습니다.');
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (password !== process.env.REACT_APP_PASSWORD) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      setIsPasswordVerified(true);
      setError(null);
      setActiveStep(1);
    } else if (activeStep === 1) {
      if (!examInfo.exam_name) {
        setError('모의고사 이름을 입력해주세요.');
        return;
      }
      
      // 전체 모의고사의 가장 최근 회차 찾기
      const maxRound = scores.length > 0 
        ? Math.max(...scores.map(score => score.round))
        : 0;
      console.log('전체 최대 회차:', maxRound);
      
      // 다음 회차 설정
      setExamInfo(prev => ({
        ...prev,
        round: maxRound + 1
      }));
      setError(null);
      setStudentScores({}); // 학생 점수 초기화
      setActiveStep(2); // 점수 입력 단계로 이동
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStep !== 2) return; // 점수 입력 단계가 아니면 제출하지 않음

    try {
      // 점수가 입력된 학생만 필터링하고 유효한 점수만 포함
      const scoresToInsert = STUDENT_LIST
        .filter(student => {
          const score = studentScores[student];
          return score !== '' && score !== undefined && score >= 0 && score <= 100;
        })
        .map(student => ({
          exam_name: examInfo.exam_name,
          round: examInfo.round,
          score: studentScores[student] as number,
          student_name: student
        }));

      if (scoresToInsert.length === 0) {
        setError('최소 한 명 이상의 학생 점수를 입력해주세요.');
        return;
      }

      console.log('저장할 점수:', scoresToInsert);

      const { error } = await supabase
        .from('exam_scores')
        .insert(scoresToInsert);

      if (error) {
        console.error('Error inserting scores:', error);
        setError('성적을 저장하는 중 오류가 발생했습니다.');
      } else {
        // 저장 성공 후 상태 초기화
        setExamInfo({
          exam_name: '',
          round: 1
        });
        setStudentScores({});
        setActiveStep(0);
        setIsPasswordVerified(false);
        setPassword('');
        await fetchScores();
        setError(null);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('예기치 않은 오류가 발생했습니다.');
    }
  };

  const getStudentData = (studentName: string) => {
    const studentScores = scores.filter(score => score.student_name === studentName);
    if (studentScores.length === 0) return [];

    // 모든 회차에 대한 데이터 생성
    const allRounds = Array.from(new Set(scores.map(score => score.round))).sort((a, b) => a - b);
    
    return allRounds.map(round => {
      const score = studentScores.find(s => s.round === round);
      return {
        round,
        score: score ? score.score : null,
        exam_name: score ? score.exam_name : '미응시'
      };
    });
  };

  const steps = ['비밀번호 확인', '모의고사 정보 입력', '학생별 점수 입력'];

  const toggleStudent = (student: string) => {
    setSelectedStudents(prev => ({
      ...prev,
      [student]: !prev[student]
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        모의고사 성적 추적
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box component="form" onSubmit={handleSubmit}>
          {activeStep === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{ minWidth: 120 }}
              >
                다음
              </Button>
            </Box>
          ) : activeStep === 1 ? (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="모의고사 이름"
                value={examInfo.exam_name}
                onChange={(e) => setExamInfo({ ...examInfo, exam_name: e.target.value })}
                required
                fullWidth
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  sx={{ minWidth: 120 }}
                >
                  이전
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{ minWidth: 120 }}
                >
                  다음
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {examInfo.exam_name} {examInfo.round}회차 점수 입력
              </Typography>
              {STUDENT_LIST.map((student) => (
                <TextField
                  key={student}
                  label={`${student}의 점수`}
                  type="number"
                  value={studentScores[student] || ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseInt(e.target.value);
                    if (value === '' || (value >= 0 && value <= 100)) {
                      setStudentScores({ ...studentScores, [student]: value });
                    }
                  }}
                  inputProps={{ min: 0, max: 100, step: 1 }}
                  placeholder="점수를 입력하세요 (미응시시 비워두세요)"
                />
              ))}
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  sx={{ minWidth: 120 }}
                >
                  이전
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ minWidth: 120 }}
                >
                  저장
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          성적 추이 그래프
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {STUDENT_LIST.map((student) => (
            <Button
              key={student}
              variant={selectedStudents[student] ? "contained" : "outlined"}
              onClick={() => toggleStudent(student)}
              size="small"
              sx={{
                minWidth: 'auto',
                px: 2,
                backgroundColor: selectedStudents[student] 
                  ? `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%)`
                  : 'transparent',
                '&:hover': {
                  backgroundColor: selectedStudents[student]
                    ? `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 40%)`
                    : 'rgba(0, 0, 0, 0.04)'
                }
              }}
            >
              {student}
            </Button>
          ))}
        </Box>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="round" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickCount={10}
                allowDecimals={false}
                interval={0}
              />
              <YAxis 
                domain={[0, 100]} 
                tickCount={11}
                allowDecimals={false}
                interval={0}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              />
              <Tooltip 
                formatter={(value, name, props) => {
                  if (value === null) return ['미응시', `${name}`];
                  return [`${value}점`, `${name} (${props.payload.exam_name})`];
                }}
              />
              <Legend />
              {STUDENT_LIST.map((student, index) => {
                if (!selectedStudents[student]) return null;
                const studentData = getStudentData(student);
                return studentData.length > 0 ? (
                  <Line
                    key={student}
                    type="monotone"
                    dataKey="score"
                    data={studentData}
                    name={student}
                    stroke={`hsl(${index * 360 / STUDENT_LIST.length}, 70%, 50%)`}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                ) : null;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Paper>
    </Container>
  );
}

export default App;
