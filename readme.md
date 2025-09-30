# Veriguard

A **face recognition-based attendance and access control system** built as a final year project.  
Veriguard provides secure, automated attendance marking with anti-spoofing measures and a web-based management dashboard.

---
Demo: 'https://veriguard101.netlilfy.app'
---

# Facial Recognition with JavaScript using face-api.js
### To start up the app:
1. run npm install in the root directory
2. run node on server.js
3. go to http://localhost:5000


### Loading 4 primary models
``` javascript
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
        faceapi.nets.ageGenderNet.loadFromUri('./models'),
    ])
```

## 🚀 Features
- Real-time face recognition in the browser using **face-api.js** (TensorFlow.js).
- **Automated attendance** marking with high accuracy (>90% in tests).
- **Anti-spoofing detection** (detects attempts with photos, screens, or videos).
- **Unknown person detection** with alerts.
- **Management Dashboard**:
  - Monitor live camera feed
  - View attendance logs
  - Manage enrolled users
  - Export attendance records
- **Secure Backend**:
  - Node.js + Express.js for APIs
  - MongoDB for storing users, attendance, and logs
  - JWT authentication for administrators

---

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript, face-api.js,
- **Backend**: Node.js, Express.js  
- **Database**: MongoDB  
- **Architecture**: Client-side recognition with RESTful APIs  

---

## ⚙️ Installation & Setup

1. **Clone the repository**
   
   git clone https://github.com/ahmadali47/Veriguard


2. **Backend Setup**

npm install
npm start

3. **Frontend Setup**

Open frontend/index.html in your browser.

Allow camera permissions when prompted.

---

## 📊 Performance

Accuracy: 90% in ideal conditions

Processing speed: ~280ms per frame

Spoof detection success rate: 80%

User feedback:

95% found UI intuitive

90% reported it was faster than manual systems

---

## 🔒 Limitations

Performance depends on client hardware and lighting conditions.

Enrollment requires cooperation (clear face capture).

Currently no mobile app version.

---

## 🔮 Future Improvements

Mobile application development.

Advanced analytics & predictive reporting.

ERP system integration.

Better performance in low-light environments.

---

## 👨‍💻 Authors

Ahmad Ali

---

## 📜 License

This project is developed for academic purposes. You may use and modify it under an open-source license (MIT recommended).

---
