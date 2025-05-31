import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Container, Typography, TextField, Button, Box, Paper, Alert, Select, MenuItem, FormControl, InputLabel, Stepper, Step, StepLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, AppBar, Toolbar, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, useMediaQuery, useTheme, Grid } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { supabase } from './supabaseClient';

interface ExamScore {
  id: number;
  exam_id: number;
  student_id: number;
  score: number;
  created_at: string;
}

interface Exam {
  id: number;
  exam_name: string;
  round: number;
  created_at: string;
}

interface Student {
  id: number;
  student_name: string;
  created_at: string;
}

interface ScoreWithDetails extends ExamScore {
  exam: Exam;
  student: Student;
}

const STUDENT_LIST = ['길준혁', '박시혁', '엄윤서', '정하승'];

function App() {
  const theme = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<'score' | 'rank' | 'graph'>('score');
  const [scores, setScores] = useState<ExamScore[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
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
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getScoresWithDetails = useCallback(() => {
    return scores.map(score => {
      const exam = exams.find(e => e.id === score.exam_id);
      const student = students.find(s => s.id === score.student_id);
      return {
        ...score,
        exam: exam!,
        student: student!
      };
    });
  }, [scores, exams, students]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 학생 데이터 가져오기
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*');

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      // 모의고사 데이터 가져오기
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: true });

      if (examsError) throw examsError;
      setExams(examsData || []);

      // 성적 데이터 가져오기
      const { data: scoresData, error: scoresError } = await supabase
        .from('exam_scores_normalized')
        .select('*')
        .order('created_at', { ascending: true });

      if (scoresError) throw scoresError;
      setScores(scoresData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
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
      const maxRound = exams.length > 0 
        ? Math.max(...exams.map(exam => exam.round))
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
    if (activeStep !== 2) return;

    try {
      // 1. 모의고사 정보 저장
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          exam_name: examInfo.exam_name,
          round: examInfo.round
        })
        .select()
        .single();

      if (examError) throw examError;

      // 2. 학생 점수 저장
      const scoresToInsert = STUDENT_LIST
        .filter(student => {
          const score = studentScores[student];
          return score !== '' && score !== undefined && score >= 0 && score <= 100;
        })
        .map(student => {
          const studentData = students.find(s => s.student_name === student);
          if (!studentData) throw new Error(`학생 정보를 찾을 수 없습니다: ${student}`);
          
          return {
            exam_id: examData.id,
            student_id: studentData.id,
            score: studentScores[student] as number
          };
        });

      if (scoresToInsert.length === 0) {
        setError('최소 한 명 이상의 학생 점수를 입력해주세요.');
        return;
      }

      const { error: scoresError } = await supabase
        .from('exam_scores_normalized')
        .insert(scoresToInsert);

      if (scoresError) throw scoresError;

      // 저장 성공 후 상태 초기화
      setExamInfo({
        exam_name: '',
        round: 1
      });
      setStudentScores({});
      setActiveStep(0);
      setIsPasswordVerified(false);
      setPassword('');
      await fetchData();
      setError(null);
    } catch (err) {
      console.error('Error inserting data:', err);
      setError('데이터를 저장하는 중 오류가 발생했습니다.');
    }
  };

  const getRankingsByRound = () => {
    const scoresWithDetails = getScoresWithDetails();
    const rounds = Array.from(new Set(exams.map(exam => exam.round))).sort((a, b) => a - b);
    const filteredRounds = selectedRound === 'all' ? rounds : [selectedRound];
    
    return filteredRounds.map(round => {
      const exam = exams.find(e => e.round === round);
      const roundScores = scoresWithDetails.filter(score => score.exam.round === round);
      
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
        examName: exam?.exam_name || '',
        rankings
      };
    });
  };

  const getStudentData = React.useCallback((studentName: string) => {
    const student = students.find(s => s.student_name === studentName);
    if (!student) return [];

    const scoresWithDetails = getScoresWithDetails();
    const studentScores = scoresWithDetails.filter(score => score.student.student_name === studentName);
    if (studentScores.length === 0) return [];

    // 모든 회차에 대한 데이터 생성
    const allRounds = Array.from(new Set(exams.map(exam => exam.round))).sort((a, b) => a - b);
    
    return allRounds.map(round => {
      const exam = exams.find(e => e.round === round);
      if (!exam) return null;

      const score = studentScores.find(s => s.exam.round === round);

      return {
        round,
        score: score ? score.score : null,
        exam_name: exam.exam_name
      };
    }).filter(Boolean);
  }, [scores, exams, students, getScoresWithDetails]);

  const steps = ['비밀번호 확인', '모의고사 정보 입력', '학생별 점수 입력'];

  const toggleStudent = (student: string) => {
    setSelectedStudents(prev => ({
      ...prev,
      [student]: !prev[student]
    }));
  };

  const GraphComponent = React.memo(({ selectedStudents, scores }: { selectedStudents: { [key: string]: boolean }, scores: ExamScore[] }) => {
    const scoresWithDetails = getScoresWithDetails();
    const studentDataMap = React.useMemo(() => {
      return STUDENT_LIST.reduce((acc, student) => {
        if (selectedStudents[student]) {
          const studentScores = scoresWithDetails.filter(score => score.student.student_name === student);
          if (studentScores.length > 0) {
            const allRounds = Array.from(new Set(exams.map(exam => exam.round))).sort((a, b) => a - b);
            acc[student] = allRounds.map(round => {
              const exam = exams.find(e => e.round === round);
              const score = studentScores.find(s => s.exam.round === round);
              return {
                round,
                score: score ? score.score : null,
                exam_name: exam ? exam.exam_name : '미응시'
              };
            });
          }
        }
        return acc;
      }, {} as { [key: string]: any[] });
    }, [selectedStudents, scoresWithDetails, exams]);

    return (
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
              if (!selectedStudents[student] || !studentDataMap[student]) return null;
              return (
                <Line
                  key={student}
                  type="monotone"
                  dataKey="score"
                  data={studentDataMap[student]}
                  name={student}
                  stroke={`hsl(${index * 360 / STUDENT_LIST.length}, 70%, 50%)`}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  connectNulls={false}
                  animationDuration={300}
                  animationBegin={0}
                  animationEasing="ease-out"
                  isAnimationActive={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  });

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleViewChange = (view: 'score' | 'rank' | 'graph') => {
    setActiveView(view);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const renderDrawer = () => (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? drawerOpen : true}
      onClose={handleDrawerToggle}
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240,
          boxSizing: 'border-box',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)',
          borderRight: 'none',
        },
      }}
    >
      <Toolbar />
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleViewChange('score')}
            selected={activeView === 'score'}
            sx={{
              '&.Mui-selected': {
                background: 'rgba(26, 35, 126, 0.1)',
                '&:hover': {
                  background: 'rgba(26, 35, 126, 0.2)',
                },
              },
            }}
          >
            <ListItemIcon>
              <AddCircleIcon color={activeView === 'score' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="점수 등록" 
              primaryTypographyProps={{
                color: activeView === 'score' ? 'primary' : 'inherit',
                fontWeight: activeView === 'score' ? 'bold' : 'normal',
              }}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleViewChange('rank')}
            selected={activeView === 'rank'}
            sx={{
              '&.Mui-selected': {
                background: 'rgba(26, 35, 126, 0.1)',
                '&:hover': {
                  background: 'rgba(26, 35, 126, 0.2)',
                },
              },
            }}
          >
            <ListItemIcon>
              <EmojiEventsIcon color={activeView === 'rank' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="순위" 
              primaryTypographyProps={{
                color: activeView === 'rank' ? 'primary' : 'inherit',
                fontWeight: activeView === 'rank' ? 'bold' : 'normal',
              }}
            />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleViewChange('graph')}
            selected={activeView === 'graph'}
            sx={{
              '&.Mui-selected': {
                background: 'rgba(26, 35, 126, 0.1)',
                '&:hover': {
                  background: 'rgba(26, 35, 126, 0.2)',
                },
              },
            }}
          >
            <ListItemIcon>
              <ShowChartIcon color={activeView === 'graph' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="그래프" 
              primaryTypographyProps={{
                color: activeView === 'graph' ? 'primary' : 'inherit',
                fontWeight: activeView === 'graph' ? 'bold' : 'normal',
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );

  const renderContent = () => {
    if (!isMobile) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
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
                점수 등록
              </Typography>
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
          </Box>

          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box sx={{ flex: 1 }}>
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
                  회차별 순위
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
                      {Array.from(new Set(exams.map(exam => exam.round)))
                        .sort((a, b) => a - b)
                        .map(round => (
                          <MenuItem key={round} value={round}>
                            {round}회차
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Box>
                <TableContainer 
                  sx={{ 
                    borderRadius: 2, 
                    overflow: 'hidden',
                    '& .MuiTable-root': {
                      minWidth: 600, // 최소 너비 설정
                    },
                    '& .MuiTableCell-root': {
                      whiteSpace: 'nowrap', // 텍스트 줄바꿈 방지
                      px: { xs: 1, sm: 2 }, // 모바일에서 패딩 줄임
                      py: { xs: 1, sm: 2 }, // 모바일에서 패딩 줄임
                    },
                    '& .MuiTableHead-root .MuiTableCell-root': {
                      position: 'sticky', // 헤더 고정
                      top: 0,
                      zIndex: 1,
                      background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                    },
                    '& .MuiTableBody-root .MuiTableCell-root': {
                      fontSize: { xs: '0.75rem', sm: '1rem' }, // 모바일에서 폰트 크기 줄임
                    }
                  }}
                >
                  <Box sx={{ overflowX: 'auto' }}>
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
                              const studentRanking = rankings.find(r => r.student.student_name === student);
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
                  </Box>
                </TableContainer>
              </Paper>
            </Box>

            <Box sx={{ flex: 1 }}>
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
                <GraphComponent selectedStudents={selectedStudents} scores={scores} />
              </Paper>
            </Box>
          </Box>
        </Box>
      );
    }

    // 모바일에서는 기존처럼 하나씩 보여주기
    switch (activeView) {
      case 'score':
        return (
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
        );
      case 'rank':
        return (
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
                  {Array.from(new Set(exams.map(exam => exam.round)))
                    .sort((a, b) => a - b)
                    .map(round => (
                      <MenuItem key={round} value={round}>
                        {round}회차
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
            <TableContainer 
              sx={{ 
                borderRadius: 2, 
                overflow: 'hidden',
                '& .MuiTable-root': {
                  minWidth: 600, // 최소 너비 설정
                },
                '& .MuiTableCell-root': {
                  whiteSpace: 'nowrap', // 텍스트 줄바꿈 방지
                  px: { xs: 1, sm: 2 }, // 모바일에서 패딩 줄임
                  py: { xs: 1, sm: 2 }, // 모바일에서 패딩 줄임
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  position: 'sticky', // 헤더 고정
                  top: 0,
                  zIndex: 1,
                  background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
                },
                '& .MuiTableBody-root .MuiTableCell-root': {
                  fontSize: { xs: '0.75rem', sm: '1rem' }, // 모바일에서 폰트 크기 줄임
                }
              }}
            >
              <Box sx={{ overflowX: 'auto' }}>
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
                          const studentRanking = rankings.find(r => r.student.student_name === student);
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
              </Box>
            </TableContainer>
          </Paper>
        );
      case 'graph':
        return (
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
            <GraphComponent selectedStudents={selectedStudents} scores={scores} />
          </Paper>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)' }}>
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography 
            variant="h6" 
            noWrap 
            component="div"
            sx={{ 
              fontWeight: 800,
              background: 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            모의고사 성적 추적
          </Typography>
        </Toolbar>
      </AppBar>
      
      {isMobile && renderDrawer()}
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          mt: '64px'
        }}
      >
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
        
        {renderContent()}
      </Box>
    </Box>
  );
}

export default App;
