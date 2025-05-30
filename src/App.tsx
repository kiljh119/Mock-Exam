import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Container, Typography, TextField, Button, Box, Paper } from '@mui/material';
import { supabase } from './supabaseClient';

interface ExamScore {
  id: number;
  exam_name: string;
  round: number;
  score: number;
  student_name: string;
  created_at: string;
}

function App() {
  const [scores, setScores] = useState<ExamScore[]>([]);
  const [newScore, setNewScore] = useState({
    exam_name: '',
    round: 1,
    score: 0,
    student_name: ''
  });

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    const { data, error } = await supabase
      .from('exam_scores')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching scores:', error);
    } else {
      setScores(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('exam_scores')
      .insert([newScore]);

    if (error) {
      console.error('Error inserting score:', error);
    } else {
      setNewScore({
        exam_name: '',
        round: 1,
        score: 0,
        student_name: ''
      });
      fetchScores();
    }
  };

  const students = Array.from(new Set(scores.map(score => score.student_name)));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        모의고사 성적 추적
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="학생 이름"
            value={newScore.student_name}
            onChange={(e) => setNewScore({ ...newScore, student_name: e.target.value })}
            required
          />
          <TextField
            label="모의고사 이름"
            value={newScore.exam_name}
            onChange={(e) => setNewScore({ ...newScore, exam_name: e.target.value })}
            required
          />
          <TextField
            label="회차"
            type="number"
            value={newScore.round}
            onChange={(e) => setNewScore({ ...newScore, round: parseInt(e.target.value) })}
            required
            inputProps={{ min: 1 }}
          />
          <TextField
            label="점수"
            type="number"
            value={newScore.score}
            onChange={(e) => setNewScore({ ...newScore, score: parseInt(e.target.value) })}
            required
            inputProps={{ min: 0, max: 100 }}
          />
          <Button type="submit" variant="contained" sx={{ minWidth: 120 }}>
            성적 추가
          </Button>
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          성적 추이 그래프
        </Typography>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={scores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="round" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              {students.map((student, index) => (
                <Line
                  key={student}
                  type="monotone"
                  dataKey="score"
                  data={scores.filter(score => score.student_name === student)}
                  name={student}
                  stroke={`hsl(${index * 360 / students.length}, 70%, 50%)`}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Paper>
    </Container>
  );
}

export default App;
