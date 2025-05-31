import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Typography, TextField, Button, Box, Paper, Alert, Select, MenuItem, FormControl, Stepper, Step, StepLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, AppBar, Toolbar, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, useTheme, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import EventIcon from '@mui/icons-material/Event';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
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

interface ExamSchedule {
  id: number;
  exam_name: string;
  exam_date: string;
  created_at: string;
}

interface ScheduleFile {
  file_name: string;
  file_path: string;
}

interface ExamParticipant {
  id: number;
  schedule_id: number;
  student_name: string;
  is_participating: boolean;
  created_at: string;
}

interface Ranking {
  rank: number;
  score: number;
  student: {
    student_name: string;
  };
  exam: {
    round: number;
  };
}

type PendingScheduleAction = 'add' | 'delete' | null;

const STUDENT_LIST = ['길준혁', '박시혁', '엄윤서', '정하승'];

// 스타일 상수 정의
const commonStyles = {
  paper: {
    p: 4,
    borderRadius: 3,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    transition: 'transform 0.3s ease-in-out',
    '&:hover': {
      transform: 'translateY(-5px)'
    }
  },
  gradientText: {
    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
    backgroundClip: 'text',
    textFillColor: 'transparent',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 'bold',
    mb: 3
  },
  gradientButton: {
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
  },
  tableCell: {
    fontWeight: 'bold',
    background: 'linear-gradient(45deg, #1a237e 30%, #3949ab 90%)',
    color: 'white',
    borderBottom: 'none',
    py: 2,
    whiteSpace: 'nowrap'
  },
  dialogButton: {
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
  },
  textField: {
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
  },
  outlinedButton: {
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
  }
};

interface ScheduleRegistrationProps {
  onSubmit: (e: React.FormEvent) => void;
  newSchedule: {
    exam_name: string;
    exam_date: string;
    files: File[];
  };
  setNewSchedule: React.Dispatch<React.SetStateAction<{
    exam_name: string;
    exam_date: string;
    files: File[];
  }>>;
}

interface ScheduleListProps {
  schedules: ExamSchedule[];
  participants: ExamParticipant[];
  onParticipationChange: (scheduleId: number, studentName: string, isParticipating: boolean) => Promise<void>;
  onDeleteSchedule: (scheduleId: number) => Promise<void>;
}

// 일정 등록 컴포넌트
const ScheduleRegistration: React.FC<ScheduleRegistrationProps> = ({ onSubmit, newSchedule, setNewSchedule }) => (
  <Paper elevation={3} sx={commonStyles.paper}>
    <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
      모의고사 일정 등록
    </Typography>
    <Box component="form" onSubmit={onSubmit}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="모의고사 이름"
          value={newSchedule.exam_name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchedule({ ...newSchedule, exam_name: e.target.value })}
          required
          fullWidth
          sx={commonStyles.textField}
        />
        <TextField
          label="시험 일자"
          type="date"
          value={newSchedule.exam_date}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSchedule({ ...newSchedule, exam_date: e.target.value })}
          required
          fullWidth
          InputLabelProps={{
            shrink: true,
          }}
          sx={commonStyles.textField}
        />
        <Box sx={{ mt: 2 }}>
          <input
            type="file"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setNewSchedule({ ...newSchedule, files });
            }}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button
              variant="outlined"
              component="span"
              fullWidth
              sx={{
                ...commonStyles.outlinedButton,
                height: '56px',
                borderStyle: 'dashed',
                borderWidth: '2px',
                '&:hover': {
                  borderStyle: 'dashed',
                  borderWidth: '2px',
                }
              }}
            >
              파일 첨부하기
            </Button>
          </label>
          {newSchedule.files.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                첨부된 파일:
              </Typography>
              <List>
                {newSchedule.files.map((file, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => {
                          const newFiles = [...newSchedule.files];
                          newFiles.splice(index, 1);
                          setNewSchedule({ ...newSchedule, files: newFiles });
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={file.name}
                      secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Box>
      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={commonStyles.gradientButton}
      >
        일정 등록
      </Button>
    </Box>
  </Paper>
);

// 일정 목록 컴포넌트
const ScheduleList: React.FC<ScheduleListProps> = ({ schedules, participants, onParticipationChange, onDeleteSchedule }) => {
  const [scheduleFiles, setScheduleFiles] = useState<{ [key: number]: ScheduleFile[] }>({});

  const fetchScheduleFiles = async () => {
    try {
      const { data: filesData, error: filesError } = await supabase
        .from('schedule_files')
        .select('schedule_id, file_name, file_path');

      if (filesError) throw filesError;

      const filesBySchedule = filesData.reduce((acc, file) => {
        if (!acc[file.schedule_id]) {
          acc[file.schedule_id] = [];
        }
        acc[file.schedule_id].push({
          file_name: file.file_name,
          file_path: file.file_path
        });
        return acc;
      }, {} as { [key: number]: ScheduleFile[] });

      setScheduleFiles(filesBySchedule);
    } catch (err) {
      console.error('Error fetching schedule files:', err);
    }
  };

  // schedules가 변경될 때마다 파일 목록 새로고침
  useEffect(() => {
    fetchScheduleFiles();
  }, [schedules]);

  const handleParticipationClick = async (scheduleId: number, studentName: string, currentStatus: boolean | undefined) => {
    try {
      await onParticipationChange(scheduleId, studentName, !currentStatus);
    } catch (err) {
      console.error('Error handling participation:', err);
    }
  };

  const handleFileDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('exam-files')
        .download(filePath);

      if (error) throw error;

      // 파일 다운로드 링크 생성
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  return (
    <Paper elevation={3} sx={commonStyles.paper}>
      <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
        모의고사 일정 목록
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={commonStyles.tableCell}>모의고사</TableCell>
                <TableCell sx={commonStyles.tableCell}>일자</TableCell>
                {STUDENT_LIST.map((student) => (
                  <TableCell key={student} sx={commonStyles.tableCell}>
                    {student}
                  </TableCell>
                ))}
                <TableCell sx={commonStyles.tableCell}>파일</TableCell>
                <TableCell sx={commonStyles.tableCell}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow 
                  key={schedule.id}
                  sx={{ 
                    '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      transition: 'background-color 0.3s ease'
                    }
                  }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{schedule.exam_name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(schedule.exam_date).toLocaleDateString()}</TableCell>
                  {STUDENT_LIST.map((student) => {
                    const participant = participants.find(
                      (p: ExamParticipant) => p.schedule_id === schedule.id && p.student_name === student
                    );
                    return (
                      <TableCell key={student} sx={{ whiteSpace: 'nowrap' }}>
                        <Button
                          variant={participant?.is_participating ? "contained" : "outlined"}
                          size="small"
                          onClick={() => handleParticipationClick(schedule.id, student, participant?.is_participating)}
                          sx={{
                            minWidth: '80px',
                            borderRadius: 2,
                            py: 0.5,
                            px: 1,
                            backgroundColor: participant?.is_participating 
                              ? 'rgba(67, 160, 71, 0.1)'
                              : 'transparent',
                            borderColor: participant?.is_participating 
                              ? 'rgba(67, 160, 71, 0.5)'
                              : 'rgba(158, 158, 158, 0.5)',
                            color: participant?.is_participating 
                              ? 'rgb(67, 160, 71)'
                              : 'rgb(158, 158, 158)',
                            '&:hover': {
                              backgroundColor: participant?.is_participating 
                                ? 'rgba(67, 160, 71, 0.2)'
                                : 'rgba(158, 158, 158, 0.1)',
                              borderColor: participant?.is_participating 
                                ? 'rgb(67, 160, 71)'
                                : 'rgb(158, 158, 158)',
                            }
                          }}
                        >
                          {participant?.is_participating ? '참여' : '불참'}
                        </Button>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    {scheduleFiles[schedule.id]?.map((file: ScheduleFile, index: number) => (
                      <Button
                        key={index}
                        variant="outlined"
                        size="small"
                        onClick={() => handleFileDownload(file.file_path, file.file_name)}
                        sx={{
                          mr: 1,
                          mb: 1,
                          borderRadius: 2,
                          py: 0.5,
                          px: 1,
                          backgroundColor: 'rgba(25, 118, 210, 0.1)',
                          borderColor: 'rgba(25, 118, 210, 0.5)',
                          color: 'rgb(25, 118, 210)',
                          '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.2)',
                            borderColor: 'rgb(25, 118, 210)',
                          }
                        }}
                      >
                        {file.file_name}
                      </Button>
                    ))}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => onDeleteSchedule(schedule.id)}
                      sx={{
                        color: '#e53935',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          color: '#c62828',
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
};

function App() {
  const theme = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<'score' | 'rank' | 'graph' | 'schedule'>('score');
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
  const [selectedStudents, setSelectedStudents] = useState<{ [key: string]: boolean }>(
    STUDENT_LIST.reduce((acc, student) => ({ ...acc, [student]: true }), {})
  );
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [participants, setParticipants] = useState<ExamParticipant[]>([]);
  const [newSchedule, setNewSchedule] = useState<{
    exam_name: string;
    exam_date: string;
    files: File[];
  }>({
    exam_name: '',
    exam_date: '',
    files: []
  });
  const [schedulePassword, setSchedulePassword] = useState('');
  const [isSchedulePasswordVerified, setIsSchedulePasswordVerified] = useState(false);
  const [showSchedulePasswordDialog, setShowSchedulePasswordDialog] = useState(false);
  const [pendingScheduleAction, setPendingScheduleAction] = useState<PendingScheduleAction>(null);
  const [pendingScheduleId, setPendingScheduleId] = useState<number | null>(null);

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

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    });
  }, []);

  const getScoresWithDetails = useCallback(() => {
    console.log('getScoresWithDetails 호출됨');
    console.log('현재 scores:', scores);
    console.log('현재 exams:', exams);
    console.log('현재 students:', students);

    const scoresWithDetails = scores.map(score => {
      const exam = exams.find(e => e.id === score.exam_id);
      const student = students.find(s => s.id === score.student_id);
      
      if (!exam || !student) {
        console.warn('매칭되지 않은 데이터:', { score, exam, student });
        return null;
      }

      return {
        ...score,
        exam,
        student
      };
    }).filter((score): score is NonNullable<typeof score> => score !== null);

    console.log('처리된 성적 데이터:', scoresWithDetails);
    return scoresWithDetails;
  }, [scores, exams, students]);

  const fetchData = async () => {
    try {
      console.log('데이터 새로고침 시작...');
      
      // 학생 데이터 가져오기
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .order('student_name', { ascending: true });

      if (studentsError) {
        console.error('학생 데이터 조회 오류:', studentsError);
        throw studentsError;
      }
      console.log('학생 데이터 로드 완료:', studentsData);
      setStudents(studentsData || []);

      // 모의고사 데이터 가져오기
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .order('round', { ascending: true });

      if (examsError) {
        console.error('모의고사 데이터 조회 오류:', examsError);
        throw examsError;
      }
      console.log('모의고사 데이터 로드 완료:', examsData);
      setExams(examsData || []);

      // 성적 데이터 가져오기
      const { data: scoresData, error: scoresError } = await supabase
        .from('exam_scores_normalized')
        .select(`
          *,
          exam:exams(*),
          student:students(*)
        `)
        .order('created_at', { ascending: true });

      if (scoresError) {
        console.error('성적 데이터 조회 오류:', scoresError);
        throw scoresError;
      }
      console.log('성적 데이터 로드 완료:', scoresData);
      setScores(scoresData || []);
      setError(null);

      console.log('데이터 새로고침 완료');
    } catch (err) {
      console.error('데이터 조회 중 오류 발생:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchData();
  }, []);

  // 데이터 변경 시 자동 새로고침을 위한 구독 설정
  useEffect(() => {
    const subscription = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        console.log('데이터베이스 변경 감지, 데이터 새로고침...');
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('exam_schedules')
        .select('*')
        .order('exam_date', { ascending: true });

      if (schedulesError) throw schedulesError;
      setSchedules(schedulesData || []);

      const { data: participantsData, error: participantsError } = await supabase
        .from('exam_participants')
        .select('*');

      if (participantsError) throw participantsError;
      setParticipants(participantsData || []);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError('일정을 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (password !== process.env.REACT_APP_PASSWORD) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
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
      setPassword('');
      await fetchData();
      setError(null);
    } catch (err) {
      console.error('Error inserting data:', err);
      setError('데이터를 저장하는 중 오류가 발생했습니다.');
    }
  };

  interface RoundRanking {
    round: number;
    examName: string;
    rankings: Ranking[];
  }

  const getRankingsByRound = (): RoundRanking[] => {
    const scoresWithDetails = getScoresWithDetails();
    
    const rounds = Array.from(new Set(exams.map(exam => exam.round))).sort((a, b) => a - b);
    const filteredRounds = selectedRound === 'all' ? rounds : [selectedRound];
    
    return filteredRounds.map(round => {
      const exam = exams.find(e => e.round === round);
      const roundScores = scoresWithDetails.filter(score => score.exam.round === round);
      
      // 점수별로 그룹화하여 등수 계산
      const sortedScores = [...roundScores].sort((a, b) => b.score - a.score);
      let currentRank = 1;
      let currentScore = sortedScores[0]?.score ?? 0;
      let skipCount = 0;
      
      const rankings: Ranking[] = sortedScores.map((score, index) => {
        if (index > 0 && score.score < currentScore) {
          currentRank += skipCount + 1;
          skipCount = 0;
          currentScore = score.score;
        } else if (index > 0 && score.score === currentScore) {
          skipCount++;
        }
        
        return {
          rank: currentRank,
          score: score.score,
          student: {
            student_name: score.student.student_name
          },
          exam: {
            round: score.exam.round
          }
        };
      });

      // exam_name을 score.exam.exam_name에서 가져오도록 수정
      const examName = roundScores[0]?.exam.exam_name || exam?.exam_name || '';

      return {
        round,
        examName,
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
    }).filter((data): data is NonNullable<typeof data> => data !== null);
  }, [exams, students, getScoresWithDetails]);

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
    }, [selectedStudents, scoresWithDetails]);

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

  const handleViewChange = (view: 'score' | 'rank' | 'graph' | 'schedule') => {
    setActiveView(view);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('사용자가 앱 설치를 수락했습니다.');
    } else {
      console.log('사용자가 앱 설치를 거부했습니다.');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSchedulePasswordVerified) {
      setPendingScheduleAction('add');
      setShowSchedulePasswordDialog(true);
      return;
    }

    try {
      // 과거 날짜 체크
      const selectedDate = new Date(newSchedule.exam_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setError('과거 날짜는 선택할 수 없습니다.');
        return;
      }

      // 1. 일정 저장
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('exam_schedules')
        .insert({
          exam_name: newSchedule.exam_name,
          exam_date: newSchedule.exam_date
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;

      // 2. 참가자 정보 저장
      const participantsToInsert = STUDENT_LIST.map(student => ({
        schedule_id: scheduleData.id,
        student_name: student,
        is_participating: false
      }));

      const { error: participantsError } = await supabase
        .from('exam_participants')
        .insert(participantsToInsert);

      if (participantsError) throw participantsError;

      // 3. 파일 업로드 및 메타데이터 저장
      if (newSchedule.files.length > 0) {
        for (const file of newSchedule.files) {
          try {
            const fileExtension = file.name.split('.').pop();
            const timestamp = Date.now();
            const safeFileName = `file_${timestamp}.${fileExtension}`;
            const filePath = `${scheduleData.id}/${safeFileName}`;

            const { error: uploadError } = await supabase.storage
              .from('exam-files')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) throw uploadError;

            const { error: fileMetadataError } = await supabase
              .from('schedule_files')
              .insert({
                schedule_id: scheduleData.id,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                file_type: file.type,
                uploaded_by: 'admin'
              });

            if (fileMetadataError) throw fileMetadataError;
          } catch (err) {
            console.error('Error uploading file:', err);
            throw new Error(`파일 업로드 중 오류 발생: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
          }
        }
      }

      // 저장 성공 후 상태 초기화
      setNewSchedule({
        exam_name: '',
        exam_date: '',
        files: []
      });
      setSchedulePassword('');
      setIsSchedulePasswordVerified(false);
      setShowSchedulePasswordDialog(false);
      setPendingScheduleAction(null);
      
      // 일정과 참가자 정보 새로고침
      await fetchSchedules();
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError('일정을 저장하는 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!isSchedulePasswordVerified) {
      setPendingScheduleAction('delete');
      setPendingScheduleId(scheduleId);
      setShowSchedulePasswordDialog(true);
      return;
    }

    try {
      // 1. 스토리지의 파일 삭제
      const { data: files, error: filesError } = await supabase
        .from('schedule_files')
        .select('*')
        .eq('schedule_id', scheduleId);

      if (filesError) throw filesError;

      if (files && files.length > 0) {
        for (const file of files) {
          const { error: deleteFileError } = await supabase.storage
            .from('exam-files')
            .remove([file.file_path]);

          if (deleteFileError) {
            console.error('Error deleting file:', deleteFileError);
          }
        }
      }

      // 2. exam_schedules 테이블의 데이터 삭제 (CASCADE로 인해 관련 데이터도 자동 삭제)
      const { error: deleteScheduleError } = await supabase
        .from('exam_schedules')
        .delete()
        .eq('id', scheduleId);

      if (deleteScheduleError) throw deleteScheduleError;

      await fetchSchedules();
      setSchedulePassword('');
      setIsSchedulePasswordVerified(false);
      setShowSchedulePasswordDialog(false);
      setPendingScheduleAction(null);
      setPendingScheduleId(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError('일정을 삭제하는 중 오류가 발생했습니다.');
    }
  };

  const handleSchedulePasswordVerify = async () => {
    if (schedulePassword !== process.env.REACT_APP_PASSWORD) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setIsSchedulePasswordVerified(true);
    setError(null);
    
    try {
      if (pendingScheduleAction === 'add') {
        // 1. 일정 저장
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('exam_schedules')
          .insert({
            exam_name: newSchedule.exam_name,
            exam_date: newSchedule.exam_date
          })
          .select()
          .single();

        if (scheduleError) throw scheduleError;

        // 2. 참가자 정보 저장
        const participantsToInsert = STUDENT_LIST.map(student => ({
          schedule_id: scheduleData.id,
          student_name: student,
          is_participating: false
        }));

        const { error: participantsError } = await supabase
          .from('exam_participants')
          .insert(participantsToInsert);

        if (participantsError) throw participantsError;

        // 3. 파일 업로드 및 메타데이터 저장
        if (newSchedule.files.length > 0) {
          for (const file of newSchedule.files) {
            try {
              const fileExtension = file.name.split('.').pop();
              const timestamp = Date.now();
              const safeFileName = `file_${timestamp}.${fileExtension}`;
              const filePath = `${scheduleData.id}/${safeFileName}`;

              const { error: uploadError } = await supabase.storage
                .from('exam-files')
                .upload(filePath, file, {
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadError) throw uploadError;

              const { error: fileMetadataError } = await supabase
                .from('schedule_files')
                .insert({
                  schedule_id: scheduleData.id,
                  file_name: file.name,
                  file_path: filePath,
                  file_size: file.size,
                  file_type: file.type,
                  uploaded_by: 'admin'
                });

              if (fileMetadataError) throw fileMetadataError;
            } catch (err) {
              console.error('Error uploading file:', err);
              throw new Error(`파일 업로드 중 오류 발생: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
            }
          }
        }

        setNewSchedule({
          exam_name: '',
          exam_date: '',
          files: []
        });
      } else if (pendingScheduleAction === 'delete' && pendingScheduleId !== null) {
        // 1. 참가자 정보 삭제
        const { error: participantsError } = await supabase
          .from('exam_participants')
          .delete()
          .match({ schedule_id: pendingScheduleId });

        if (participantsError) throw participantsError;

        // 2. 일정 삭제
        const { error: scheduleError } = await supabase
          .from('exam_schedules')
          .delete()
          .match({ id: pendingScheduleId });

        if (scheduleError) throw scheduleError;
      }

      // 작업 완료 후 상태 초기화
      setSchedulePassword('');
      setIsSchedulePasswordVerified(false);
      setShowSchedulePasswordDialog(false);
      setPendingScheduleAction(null);
      setPendingScheduleId(null);
      await fetchSchedules();
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(pendingScheduleAction === 'add' ? '일정을 저장하는 중 오류가 발생했습니다.' : '일정을 삭제하는 중 오류가 발생했습니다.');
    }
  };

  const handleParticipationChange = async (scheduleId: number, studentName: string, isParticipating: boolean) => {
    try {
      // 기존 참가자 정보 찾기
      const { data: existingParticipant, error: findError } = await supabase
        .from('exam_participants')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('student_name', studentName)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116는 결과가 없는 경우
        throw findError;
      }

      if (existingParticipant) {
        // 기존 참가자 정보가 있으면 업데이트
        const { error: updateError } = await supabase
          .from('exam_participants')
          .update({ is_participating: isParticipating })
          .eq('id', existingParticipant.id);

        if (updateError) throw updateError;
      } else {
        // 기존 참가자 정보가 없으면 새로 생성
        const { error: insertError } = await supabase
          .from('exam_participants')
          .insert({
            schedule_id: scheduleId,
            student_name: studentName,
            is_participating: isParticipating
          });

        if (insertError) throw insertError;
      }

      // 참가자 목록 업데이트
      setParticipants((prevParticipants: ExamParticipant[]): ExamParticipant[] => {
        const updatedParticipants = [...prevParticipants];
        const index = updatedParticipants.findIndex(
          p => p.schedule_id === scheduleId && p.student_name === studentName
        );

        if (index !== -1) {
          // 기존 참가자 정보 업데이트
          updatedParticipants[index] = {
            ...updatedParticipants[index],
            is_participating: isParticipating
          };
        } else {
          // 새로운 참가자 정보 추가
          updatedParticipants.push({
            id: Date.now(), // 임시 ID
            schedule_id: scheduleId,
            student_name: studentName,
            is_participating: isParticipating,
            created_at: new Date().toISOString()
          });
        }

        return updatedParticipants;
      });
    } catch (err) {
      console.error('Error updating participation:', err);
      setError('참가 여부를 업데이트하는 중 오류가 발생했습니다.');
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
        <ListItem disablePadding>
          <ListItemButton 
            onClick={() => handleViewChange('schedule')}
            selected={activeView === 'schedule'}
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
              <EventIcon color={activeView === 'schedule' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="일정" 
              primaryTypographyProps={{
                color: activeView === 'schedule' ? 'primary' : 'inherit',
                fontWeight: activeView === 'schedule' ? 'bold' : 'normal',
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
          <Dialog
            open={showSchedulePasswordDialog}
            onClose={() => {
              setShowSchedulePasswordDialog(false);
              setPendingScheduleAction(null);
              setPendingScheduleId(null);
              setSchedulePassword('');
            }}
          >
            <DialogTitle>비밀번호 확인</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {pendingScheduleAction === 'add' ? '일정을 등록하려면' : '일정을 삭제하려면'} 비밀번호를 입력해주세요
              </DialogContentText>
              <TextField
                autoFocus
                margin="dense"
                label="비밀번호"
                type="password"
                fullWidth
                value={schedulePassword}
                onChange={(e) => setSchedulePassword(e.target.value)}
                sx={commonStyles.textField}
              />
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={() => {
                  setShowSchedulePasswordDialog(false);
                  setPendingScheduleAction(null);
                  setPendingScheduleId(null);
                  setSchedulePassword('');
                }}
                sx={commonStyles.outlinedButton}
              >
                취소
              </Button>
              <Button 
                onClick={handleSchedulePasswordVerify}
                sx={commonStyles.dialogButton}
              >
                확인
              </Button>
            </DialogActions>
          </Dialog>
          {activeView === 'schedule' ? (
            <Box>
              <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={commonStyles.gradientText}>
                    모의고사 일정 관리
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => handleViewChange('score')}
                    startIcon={<ArrowBackIcon />}
                    sx={commonStyles.outlinedButton}
                  >
                    뒤로 가기
                  </Button>
                </Box>
                <ScheduleRegistration 
                  onSubmit={handleScheduleSubmit}
                  newSchedule={newSchedule}
                  setNewSchedule={setNewSchedule}
                />
                <ScheduleList 
                  schedules={schedules}
                  participants={participants}
                  onParticipationChange={handleParticipationChange}
                  onDeleteSchedule={handleDeleteSchedule}
                />
              </Paper>
            </Box>
          ) : (
            <>
              <Box>
                <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
                    점수 등록
                  </Typography>
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
                          sx={commonStyles.textField}
                        />
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={commonStyles.dialogButton}
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
                          sx={commonStyles.textField}
                        />
                        <Box sx={{ display: 'flex', gap: 2, mt: 2, width: '100%' }}>
                          <Button
                            variant="outlined"
                            onClick={handleBack}
                            sx={commonStyles.outlinedButton}
                          >
                            이전
                          </Button>
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            sx={commonStyles.dialogButton}
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
                            sx={commonStyles.textField}
                          />
                        ))}
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                          <Button
                            variant="outlined"
                            onClick={handleBack}
                            sx={commonStyles.outlinedButton}
                          >
                            이전
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            sx={commonStyles.dialogButton}
                          >
                            저장
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Box>

              <Box>
                <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
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
                            {/* 파일과 관리 열 제거 */}
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
                              {STUDENT_LIST.map((student) => {
                                const studentRanking = rankings.find((r: Ranking) => r?.student?.student_name === student);
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
                              {/* 파일과 관리 열 제거 */}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </TableContainer>
                </Paper>
              </Box>

              <Box>
                <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
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
            </>
          )}
        </Box>
      );
    }

    // 모바일 뷰
    switch (activeView) {
      case 'schedule':
        return (
          <>
            <Dialog
              open={showSchedulePasswordDialog}
              onClose={() => {
                setShowSchedulePasswordDialog(false);
                setPendingScheduleAction(null);
                setPendingScheduleId(null);
                setSchedulePassword('');
              }}
            >
              <DialogTitle>비밀번호 확인</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  {pendingScheduleAction === 'add' ? '일정을 등록하려면' : '일정을 삭제하려면'} 비밀번호를 입력해주세요
                </DialogContentText>
                <TextField
                  autoFocus
                  margin="dense"
                  label="비밀번호"
                  type="password"
                  fullWidth
                  value={schedulePassword}
                  onChange={(e) => setSchedulePassword(e.target.value)}
                  sx={commonStyles.textField}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => {
                  setShowSchedulePasswordDialog(false);
                  setPendingScheduleAction(null);
                  setPendingScheduleId(null);
                  setSchedulePassword('');
                }} sx={commonStyles.outlinedButton}>
                  취소
                </Button>
                <Button onClick={handleSchedulePasswordVerify} sx={commonStyles.dialogButton}>
                  확인
                </Button>
              </DialogActions>
            </Dialog>
            <ScheduleRegistration 
              onSubmit={handleScheduleSubmit}
              newSchedule={newSchedule}
              setNewSchedule={setNewSchedule}
            />
            <ScheduleList 
              schedules={schedules}
              participants={participants}
              onParticipationChange={handleParticipationChange}
              onDeleteSchedule={handleDeleteSchedule}
            />
          </>
        );
      case 'score':
        return (
          <>
            <Box>
              <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
                  점수 등록
                </Typography>
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
                        sx={commonStyles.textField}
                      />
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        sx={commonStyles.dialogButton}
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
                        sx={commonStyles.textField}
                      />
                      <Box sx={{ display: 'flex', gap: 2, mt: 2, width: '100%' }}>
                        <Button
                          variant="outlined"
                          onClick={handleBack}
                          sx={commonStyles.outlinedButton}
                        >
                          이전
                        </Button>
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={commonStyles.dialogButton}
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
                          sx={commonStyles.textField}
                        />
                      ))}
                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={handleBack}
                          sx={commonStyles.outlinedButton}
                        >
                          이전
                        </Button>
                        <Button
                          type="submit"
                          variant="contained"
                          sx={commonStyles.dialogButton}
                        >
                          저장
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Box>
          </>
        );
      case 'rank':
        return (
          <>
            <Box>
              <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
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
                            {STUDENT_LIST.map((student) => {
                              const studentRanking = rankings.find((r: Ranking) => r?.student?.student_name === student);
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
          </>
        );
      case 'graph':
        return (
          <>
            <Box>
              <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom sx={commonStyles.gradientText}>
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
          </>
        );
      default:
        return null;
    }
  };

  // 지난 일정 자동 삭제 함수
  const cleanupPastSchedules = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 지난 일정 찾기
      const { data: pastSchedules, error: fetchError } = await supabase
        .from('exam_schedules')
        .select('*')
        .lt('exam_date', today.toISOString());

      if (fetchError) throw fetchError;

      if (pastSchedules && pastSchedules.length > 0) {
        for (const schedule of pastSchedules) {
          // 1. 관련 파일 찾기
          const { data: files, error: filesError } = await supabase
            .from('schedule_files')
            .select('*')
            .eq('schedule_id', schedule.id);

          if (filesError) throw filesError;

          // 2. 파일 삭제
          if (files && files.length > 0) {
            for (const file of files) {
              const { error: deleteFileError } = await supabase.storage
                .from('exam-files')
                .remove([file.file_path]);

              if (deleteFileError) {
                console.error('Error deleting file:', deleteFileError);
              }
            }

            // 3. 파일 메타데이터 삭제
            const { error: deleteFilesMetadataError } = await supabase
              .from('schedule_files')
              .delete()
              .eq('schedule_id', schedule.id);

            if (deleteFilesMetadataError) throw deleteFilesMetadataError;
          }

          // 4. 참가자 정보 삭제
          const { error: deleteParticipantsError } = await supabase
            .from('exam_participants')
            .delete()
            .eq('schedule_id', schedule.id);

          if (deleteParticipantsError) throw deleteParticipantsError;

          // 5. 일정 삭제
          const { error: deleteScheduleError } = await supabase
            .from('exam_schedules')
            .delete()
            .eq('id', schedule.id);

          if (deleteScheduleError) throw deleteScheduleError;
        }
      }
    } catch (err) {
      console.error('Error cleaning up past schedules:', err);
    }
  };

  // 컴포넌트 마운트 시 지난 일정 정리
  useEffect(() => {
    cleanupPastSchedules();
    // 매일 자정에 지난 일정 정리
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const cleanupInterval = setInterval(() => {
      cleanupPastSchedules();
    }, 24 * 60 * 60 * 1000); // 24시간마다 실행

    return () => clearInterval(cleanupInterval);
  }, []);

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
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {!isMobile && (
              <Button
                color="inherit"
                onClick={() => handleViewChange('schedule')}
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.2)',
                  }
                }}
              >
                일정 등록
              </Button>
            )}
            {showInstallPrompt && (
              <Button
                color="inherit"
                onClick={handleInstallClick}
                sx={{ 
                  background: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.2)',
                  }
                }}
              >
                앱 설치하기
              </Button>
            )}
          </Box>
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
