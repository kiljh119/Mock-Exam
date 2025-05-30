import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Container, Typography, TextField, Button, Box, Paper, Alert, Select, MenuItem, FormControl, InputLabel, Stepper, Step, StepLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
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
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');

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

  const getRankingsByRound = () => {
    const rounds = Array.from(new Set(scores.map(score => score.round))).sort((a, b) => a - b);
    const filteredRounds = selectedRound === 'all' ? rounds : [selectedRound];
    
    return filteredRounds.map(round => {
      const roundScores = scores.filter(score => score.round === round);
      const examName = roundScores[0]?.exam_name || '';
      
      // 점수별로 그룹화하여 등수 계산
      const sortedScores = [...roundScores].sort((a, b) => b.score - a.score);
      let currentRank = 1;
      let currentScore = sortedScores[0]?.score;
      let skipCount = 0;
      
      const rankings = sortedScores.map((score, index) => {
        if (index > 0 && score.score < currentScore) {
          currentRank += skipCount + 1;
          skipCount = 0;
          currentScore = score.score;
        } else if (index > 0 && score.score === currentScore) {
          skipCount++;
        }
        
        return {
          ...score,
          rank: currentRank
        };
      });

      return {
        round,
        examName,
        rankings
      };
    });
  };

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        py: 4,
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)',
        minHeight: '100vh'
      }}
    >
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom 
        align="center"
        sx={{ 
          fontWeight: 800,
          background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
          backgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 4,
          textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        모의고사 성적 추적
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            animation: 'slideIn 0.3s ease-out',
            '@keyframes slideIn': {
              '0%': {
                transform: 'translateY(-20px)',
                opacity: 0
              },
              '100%': {
                transform: 'translateY(0)',
                opacity: 1
              }
            }
          }}
        >
          {error}
        </Alert>
      )}

      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          mb: 4,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)'
          }
        }}
      >
        <Stepper 
          activeStep={activeStep} 
          sx={{ 
            mb: 4,
            '& .MuiStepLabel-label': {
              fontWeight: 600,
              color: '#1a237e'
            },
            '& .MuiStepIcon-root': {
              color: '#1a237e'
            },
            '& .MuiStepIcon-root.Mui-active': {
              color: '#3949ab'
            },
            '& .MuiStepIcon-root.Mui-completed': {
              color: '#3949ab'
            }
          }}
        >
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{ 
                  minWidth: 120,
                  borderRadius: 2,
                  py: 1.5,
                  background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                  boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(26, 35, 126, 0.4)',
                    background: 'linear-gradient(45deg, #0d1757 30%, #1a237e 90%)'
                  }
                }}
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
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    },
                    '&.Mui-focused': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 2, width: '100%' }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  sx={{ 
                    minWidth: 120,
                    borderRadius: 2,
                    py: 1.5,
                    borderColor: '#1a237e',
                    color: '#1a237e',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: '#0d1757',
                      backgroundColor: 'rgba(26, 35, 126, 0.04)',
                      boxShadow: '0 4px 12px rgba(26, 35, 126, 0.1)'
                    }
                  }}
                >
                  이전
                </Button>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{ 
                    minWidth: 120,
                    borderRadius: 2,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                    boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(26, 35, 126, 0.4)',
                      background: 'linear-gradient(45deg, #0d1757 30%, #1a237e 90%)'
                    }
                  }}
                >
                  다음
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography 
                variant="h6" 
                gutterBottom
                sx={{ 
                  background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                  backgroundClip: 'text',
                  textFillColor: 'transparent',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 'bold',
                  mb: 2
                }}
              >
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      },
                      '&.Mui-focused': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }
                    }
                  }}
                />
              ))}
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  sx={{ 
                    minWidth: 120,
                    borderRadius: 2,
                    py: 1.5,
                    borderColor: '#1a237e',
                    color: '#1a237e',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      borderColor: '#0d1757',
                      backgroundColor: 'rgba(26, 35, 126, 0.04)',
                      boxShadow: '0 4px 12px rgba(26, 35, 126, 0.1)'
                    }
                  }}
                >
                  이전
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ 
                    minWidth: 120,
                    borderRadius: 2,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                    boxShadow: '0 4px 12px rgba(26, 35, 126, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 16px rgba(26, 35, 126, 0.4)',
                      background: 'linear-gradient(45deg, #0d1757 30%, #1a237e 90%)'
                    }
                  }}
                >
                  저장
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      <Paper 
        elevation={3} 
        sx={{ 
          p: 4,
          mb: 4,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)'
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 'bold'
            }}
          >
            회차별 순위
          </Typography>
          <FormControl 
            sx={{ 
              minWidth: 200,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.9)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
              }
            }}
          >
            <Select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value as number | 'all')}
              displayEmpty
              sx={{
                '& .MuiSelect-select': {
                  py: 1.5
                }
              }}
            >
              <MenuItem value="all">전체 회차</MenuItem>
              {Array.from(new Set(scores.map(score => score.round)))
                .sort((a, b) => a - b)
                .map(round => (
                  <MenuItem key={round} value={round}>
                    {round}회차
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>
        <TableContainer sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                    color: 'white',
                    borderBottom: 'none',
                    py: 2,
                    width: '15%'
                  }}
                >
                  회차
                </TableCell>
                <TableCell 
                  sx={{ 
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                    color: 'white',
                    borderBottom: 'none',
                    py: 2,
                    width: '25%'
                  }}
                >
                  모의고사
                </TableCell>
                {STUDENT_LIST.map((student, index) => (
                  <TableCell 
                    key={student}
                    sx={{ 
                      fontWeight: 'bold',
                      background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                      color: 'white',
                      borderBottom: 'none',
                      py: 2,
                      width: `${60 / STUDENT_LIST.length}%`
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        background: `hsl(${index * 360 / STUDENT_LIST.length}, 70%, 40%)`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: `hsl(${index * 360 / STUDENT_LIST.length}, 70%, 35%)`
                        }
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      >
                        {student}
                      </Typography>
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {getRankingsByRound().map(({ round, examName, rankings }) => (
                <TableRow 
                  key={round}
                  sx={{ 
                    '&:nth-of-type(odd)': { 
                      backgroundColor: 'rgba(0, 0, 0, 0.02)' 
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      transition: 'background-color 0.3s ease'
                    }
                  }}
                >
                  <TableCell 
                    sx={{ 
                      fontWeight: 'bold',
                      color: '#1a237e',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                      py: 2
                    }}
                  >
                    {round}회차
                  </TableCell>
                  <TableCell
                    sx={{
                      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                      py: 2
                    }}
                  >
                    {examName}
                  </TableCell>
                  {STUDENT_LIST.map((student, index) => {
                    const studentRanking = rankings.find(r => r.student_name === student);
                    return (
                      <TableCell 
                        key={student}
                        sx={{
                          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                          py: 2
                        }}
                      >
                        {studentRanking ? (
                          <Box 
                            sx={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 0.5
                            }}
                          >
                            <Typography 
                              sx={{ 
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                color: studentRanking.rank === 1 
                                  ? '#e53935'  // 1위: 빨간색
                                  : studentRanking.rank === 2
                                  ? '#fb8c00'  // 2위: 주황색
                                  : studentRanking.rank === 3
                                  ? '#43a047'  // 3위: 초록색
                                  : '#1e88e5'  // 4위: 파란색
                              }}
                            >
                              {studentRanking.rank}위
                            </Typography>
                            <Typography 
                              sx={{ 
                                color: '#666',
                                fontWeight: 500,
                                fontSize: '0.9rem'
                              }}
                            >
                              {studentRanking.score}점
                            </Typography>
                          </Box>
                        ) : (
                          <Typography 
                            sx={{ 
                              color: '#999',
                              textAlign: 'center'
                            }}
                          >
                            미응시
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper 
        elevation={3} 
        sx={{ 
          p: 4,
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': {
            transform: 'translateY(-5px)'
          }
        }}
      >
        <Typography 
          variant="h6" 
          gutterBottom
          sx={{ 
            background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold',
            mb: 3
          }}
        >
          성적 추이 그래프
        </Typography>
        <Box 
          sx={{ 
            mb: 3, 
            display: 'flex', 
            gap: 1, 
            flexWrap: 'wrap',
            '& .MuiButton-root': {
              textTransform: 'none',
              fontWeight: 500,
              transition: 'all 0.3s ease'
            }
          }}
        >
          {STUDENT_LIST.map((student) => (
            <Button
              key={student}
              variant={selectedStudents[student] ? "contained" : "outlined"}
              onClick={() => toggleStudent(student)}
              size="small"
              sx={{
                minWidth: 'auto',
                px: 2,
                py: 1,
                borderRadius: 2,
                backgroundColor: selectedStudents[student] 
                  ? `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%)`
                  : 'transparent',
                borderColor: `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%)`,
                color: selectedStudents[student] ? 'white' : `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%)`,
                boxShadow: selectedStudents[student] 
                  ? `0 4px 12px hsla(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%, 0.3)`
                  : 'none',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  backgroundColor: selectedStudents[student]
                    ? `hsl(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 40%)`
                    : `hsla(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%, 0.1)`,
                  boxShadow: selectedStudents[student]
                    ? `0 6px 16px hsla(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%, 0.4)`
                    : `0 4px 12px hsla(${STUDENT_LIST.indexOf(student) * 360 / STUDENT_LIST.length}, 70%, 50%, 0.1)`
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="round" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickCount={10}
                allowDecimals={false}
                interval={0}
                stroke="#666"
              />
              <YAxis 
                domain={[0, 100]} 
                tickCount={11}
                allowDecimals={false}
                interval={0}
                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                stroke="#666"
              />
              <Tooltip 
                formatter={(value, name, props) => {
                  if (value === null) return ['미응시', `${name}`];
                  return [`${value}점`, `${name} (${props.payload.exam_name})`];
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(10px)',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
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
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    connectNulls={false}
                    animationDuration={1000}
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
