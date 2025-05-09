import { useEffect, useState, useContext } from 'react';
import { AppContext } from "../App";
import { update, ref, set } from "firebase/database";
import { db } from "./Firebase";
import { useNavigate } from 'react-router-dom';

function QuizPage() {
    const navigate = useNavigate();

    const { setShowSpinner, setUserData, showSpinner, setPopUpValue, userData, storedChoosedAnswers, setStoredChoosedAnswers, setUserScore, questions  ,  setQuestions, setAllPlayedUsers, setUserRank, allPlayedUsers } = useContext(AppContext);
    const [showTimeout, setShowTimeout] = useState(false);
    const [questionIndex, setQuestionIndex] = useState(1);

    const [minutes, setMinutes] = useState(Math.floor((userData.quizEndsAt - new Date().getTime()) / 1000 / 60));
    const [seconds, setSeconds] = useState(Math.floor((userData.quizEndsAt - new Date().getTime()) / 1000 % 60));

    useEffect(() => {
        let interval;
        if (!showSpinner && !userData.finished) {
            interval = setInterval(() => {
                setSeconds(Math.floor((userData.quizEndsAt - new Date().getTime()) / 1000 % 60));
                setMinutes(Math.floor((userData.quizEndsAt - new Date().getTime()) / 1000 / 60));
            }, 1000);
        }

        if(userData) {
            setShowSpinner(false);
        }else {
            setShowSpinner(true);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showSpinner , userData]);

    useEffect(() => {
        if (minutes === 0 && seconds === 0) {
            setShowTimeout(true);
            setPopUpValue("Time is up!");
            finish();
        }
    }, [minutes, seconds])

    useEffect(() => {
        if (showTimeout) {
            setPopUpValue("Time is up!");
            setShowTimeout(false);
        }
    }, [showTimeout])

    useEffect(() => {
        if (!questions.length) {
            setShowSpinner(true);
            fetch(process.env.REACT_APP_GET_QUESTIONS_API).then((res) => {
                return res.json();
            }).then((data) => {
                let questions = data.data;
                for (let i = 0; i < questions.length; i++) {
                    let answers = [questions[i].correct_answer, questions[i].wrong_answer_1, questions[i].wrong_answer_2, questions[i].wrong_answer_3];
                    const randomAnswers = () => {
                        const newAnswers = [];
                        while (newAnswers.length < 4) {
                            const randomIndex = Math.floor(Math.random() * answers.length);
                            newAnswers.push(answers[randomIndex]);
                            answers.splice(randomIndex, 1);
                        }
                        answers = newAnswers;
                    }
                    randomAnswers();
                    const newQuestionObject = {
                        question: questions[i].the_question,
                        answers: answers.sort(() => Math.random() - 0.5),
                        correct_answer: questions[i].correct_answer,
                    };
                    questions[i] = newQuestionObject;
                }
                setQuestions(questions);
                setShowSpinner(false);
            }).catch((err) => {
                console.log(err);
                setShowSpinner(false);
                setPopUpValue("Sorry, an error occurred while fetching the questions!");
                navigate("/");
            })
        } else {
            if (!questions[0].answers) {
                for (let i = 0; i < questions.length; i++) {
                    let answers = [questions[i].correct_answer , questions[i].wrong_answer_1, questions[i].wrong_answer_2, questions[i].wrong_answer_3];
                    const randomAnswers = () => {
                        const newAnswers = [];
                        while (newAnswers.length < 4) {
                            const randomIndex = Math.floor(Math.random() * answers.length);
                            newAnswers.push(answers[randomIndex]);
                            answers.splice(randomIndex, 1);
                        }
                        answers = newAnswers;
                    }
                    randomAnswers();
                    const newQuestionObject = {
                        question: questions[i].the_question,
                        answers: answers,
                        correct_answer: questions[i].correct_answer,
                    };
                    questions[i] = newQuestionObject;
                }
                setQuestions(questions);
                setShowSpinner(false);
            }
        }
    }, [questions])

    const finish = () => {
        if (!userData.finished) {
            let score = 0;
            let correctQuestionPoints = 5;
            let wrongAnswers = [];
            let unAnsweredQuestions = [];

            for (let i = 0; i < questions.length; i++) {
                if (storedChoosedAnswers[i] === questions[i].correct_answer) {
                    score += correctQuestionPoints;
                } else {
                    if (storedChoosedAnswers[i] === undefined) {
                        unAnsweredQuestions.push(questions[i]);
                    } else {
                        wrongAnswers.push(questions[i]);
                    }
                }
            }
            setUserScore(score);
            setShowSpinner(true);
            let finishedAt = new Date().getTime();
            set(ref(db, "finished_users/" + localStorage.getItem("user")), {
                score: score,
                username: userData.username,
                userID: localStorage.getItem("user"),
            }).then(() => {
                const newPlayedUser = {
                    score: score,
                    username: userData.username,
                    userID: localStorage.getItem("user"),
                };
                setAllPlayedUsers((prev) => {
                    return [...prev, newPlayedUser];
                })
                let allUsers = allPlayedUsers;
                allUsers.sort((a, b) => b.score - a.score);
                setAllPlayedUsers(allUsers);
                for (let i = 0; i < allUsers.length; i++) {
                    if (allUsers[i].userID === localStorage.getItem("user")) {
                        setUserRank(i + 1);
                        break;
                    }
                }
            })
            update(ref(db, "users/" + localStorage.getItem("user")), {
                finished: true,
                finishedAt: finishedAt,
                score: score,
                quizStarted: false,
            }).then(() => {
                setShowSpinner(false);
                navigate("/result");
                let newUserData = {
                    email: userData.email,
                    finished: true,
                    finishedAt: finishedAt,
                    quizStarted: false,
                    quizEndsAt: userData.quizEndsAt,
                    score: score,
                    choosedAnswers: storedChoosedAnswers,
                    username: userData.username,
                    userID: userData.userID,
                }
                setUserData(newUserData);
            }).catch((err) => {
                console.log(err.code);
                setPopUpValue("Sorry, an error occurred while finishing the quiz!");
            })
        } else {
            navigate("/result");
        }
    }

    const setAnswer = (index) => {
        if (!userData.finished) {
            const the_answer = questions[questionIndex - 1].answers[index];
            let answers = storedChoosedAnswers;
            answers[questionIndex - 1] = the_answer;
            setStoredChoosedAnswers(answers);
            update(ref(db, "users/" + localStorage.getItem("user")), {
                choosedAnswers: storedChoosedAnswers,
            }).catch((err) => {
                console.log(err.code);
                console.log("Cannot save the answers in the database!");;
            })
        }
    }

    useEffect(() => {
        if (userData.finished && window.location.pathname === "/quiz-page") {
            navigate("/result");
        }
    }, [])

    return (
        <div className="quiz_page_container">
            <div className="header">
                <div className="content">{questionIndex < 10 ? "0" + questionIndex : questionIndex}/{questions.length}</div>
                <div className="content website_name">Quiz With Me</div>
                <div className="content"><i className="bi bi-clock"></i> {userData.finished ? "Finished" : (minutes >= 10 ? minutes : "0" + minutes) + ":" + (seconds >= 10 ? seconds : "0" + seconds)}</div>
            </div>
            <div className="question_container">
                <div className="content">
                    <div className="question"><p>{questions.length && questions[questionIndex - 1].question}</p></div>
                    <div className="answers">
                        <button onClick={() => setAnswer(0)} className={"answer " + (questions.length && (questions[questionIndex - 1] && questions[questionIndex - 1].answers) && window.location.pathname !== "/quiz-page" && questions[questionIndex - 1].correct_answer === questions[questionIndex - 1].answers[0] ? "correct" : (window.location.pathname === "/see-answers" ? "incorrect" : "")) + " " + (questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] === questions[questionIndex - 1].answers[0] ? "active" : "")}>{questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1].answers[0]}</button>
                        <button onClick={() => setAnswer(1)} className={"answer " + (questions.length && questions[questionIndex - 1] && questions[questionIndex - 1].answers && window.location.pathname !== "/quiz-page" && questions[questionIndex - 1].correct_answer === questions[questionIndex - 1].answers[1] ? "correct" : (window.location.pathname === "/see-answers" ? "incorrect" : "")) + " " +  (questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] === questions[questionIndex - 1].answers[1] ? "active" : "")}>{questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1].answers[1]}</button>
                        <button onClick={() => setAnswer(2)} className={"answer " + (questions.length && questions[questionIndex - 1] && questions[questionIndex - 1].answers && window.location.pathname !== "/quiz-page" && questions[questionIndex - 1].correct_answer === questions[questionIndex - 1].answers[2] ? "correct" : (window.location.pathname === "/see-answers" ? "incorrect" : "")) + " " +  (questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] === questions[questionIndex - 1].answers[2] ? "active" : "")}>{questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1].answers[2]}</button>
                        <button onClick={() => setAnswer(3)} className={"answer " + (questions.length && questions[questionIndex - 1] && questions[questionIndex - 1].answers && window.location.pathname !== "/quiz-page" && questions[questionIndex - 1].correct_answer === questions[questionIndex - 1].answers[3] ? "correct" : (window.location.pathname === "/see-answers" ? "incorrect" : "")) + " " +  (questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] && storedChoosedAnswers[questionIndex - 1] === questions[questionIndex - 1].answers[3] ? "active" : "")}>{questions.length && questions[questionIndex - 1].answers && questions[questionIndex - 1].answers[3]}</button>
                    </div>
                </div>
            </div>
            <div className="controls_container">
                <button className="control" onClick={() => {questionIndex > 1 ? setQuestionIndex(questionIndex - 1) : console.log("No questions before this questions.")}}><i className="bi bi-chevron-left"></i> Prev</button>
                {userData.finished ? <button className="home" onClick={() => navigate("/")}>Home Page</button> : ""}
                <button className="control" onClick={() => { questionIndex === questions.length ? finish() : setQuestionIndex(questionIndex + 1) }}>{questionIndex === questions.length ? "Finish" : "Next"} {questionIndex === questions.length ? "" : <i className="bi bi-chevron-right"></i>}</button>
            </div>
        </div>
    );
}

export default QuizPage;