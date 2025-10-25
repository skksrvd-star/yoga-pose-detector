# 🧘 Yoga Pose Trainer

An interactive real-time yoga pose detection application powered by MediaPipe Pose Landmarker. Practice yoga poses with live feedback and tracking!

![Yoga Pose Trainer](https://img.shields.io/badge/Yoga-Pose%20Trainer-purple)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-green)

## ✨ Features

- **Real-time Pose Detection**: Uses MediaPipe Pose Landmarker for accurate body tracking
- **60+ Yoga Poses**: Comprehensive library covering standing, seated, balance, inversions, and more
- **Live Visual Feedback**: Skeleton overlay shows detected keypoints and connections
- **Confidence Levels**: Adjustable thresholds (Easy, Medium, Hard, Expert) for different skill levels
- **Pose Counter**: Tracks successfully detected poses during your session
- **Camera Controls**: Switch between front/back cameras, zoom in/out
- **Sound Notifications**: Audio feedback when poses are detected (toggle on/off)
- **Responsive Design**: Works on desktop and mobile devices
- **Practice Mode**: Select target poses and match them in real-time

## 🎯 Supported Poses

### Standing Poses
- Mountain Pose, Tree Pose, Chair Pose
- Warrior I, II, III
- Triangle Pose, Half Moon Pose
- Standing Forward Bend, Wide-Legged Forward Bend
- Garland Pose, Standing Split

### Balance Poses
- Tree Pose, Eagle Pose
- Dancer Pose, King Dancer Pose
- Warrior III, Half Moon Pose

### Seated Poses
- Easy Pose, Lotus Pose, Hero Pose
- Staff Pose, Boat Pose
- Seated Forward Bend, Head to Knee Pose
- Bound Angle Pose, Half Lord of the Fishes
- Cow Face Pose

### Floor Poses (Prone)
- Cobra Pose, Upward Dog
- Bow Pose, Locust Pose
- Half Frog Pose, Full Frog Pose

### Floor Poses (Supine)
- Bridge Pose, Fish Pose
- Happy Baby Pose, Corpse Pose
- Reclined Pigeon Pose, Reclined Hero Pose

### Kneeling & All-Fours
- Child's Pose, Cat Pose, Cow Pose
- Camel Pose, Pigeon Pose

### Plank Variations
- Plank Pose, Side Plank
- Downward Dog

### Lunges
- High Lunge, Low Lunge

### Inversions & Arm Balances
- Headstand, Handstand, Forearm Stand
- Shoulder Stand, Plow Pose
- Crow Pose, Side Crow Pose
- Peacock Pose, Firefly Pose
- Eight-Angle Pose, Scorpion Pose

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A device with a camera
- Modern web browser (Chrome, Edge, Safari, Firefox)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/yoga-pose-trainer.git
cd yoga-pose-trainer
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
├── app/
│   ├── YogaPoseDetector.tsx    # Main component
│   ├── components/
│   │   ├── CameraControls.tsx  # Camera control buttons
│   │   └── PosePanel.tsx       # Pose selection & display
│   ├── constants/
│   │   └── yoga.constants.ts   # Configuration constants
│   ├── types/
│   │   └── yoga.types.ts       # TypeScript type definitions
│   ├── utils/
│   │   ├── angleCalculator.ts  # Angle calculation utilities
│   │   ├── dataLoader.ts       # Model & data loading
│   │   ├── poseClassifier.ts   # Pose classification logic
│   │   ├── skeletonDrawer.ts   # Canvas drawing utilities
│   │   └── soundUtils.ts       # Audio feedback
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── public/
│   └── poses/                  # Pose reference images
│       └── posesData.json      # Pose metadata
└── package.json
```

## 🎮 How to Use

1. **Start Camera**: Click "Start Camera" to enable your webcam
2. **Select a Pose**: Choose a target pose from the right panel
3. **Match the Pose**: Position yourself to match the target pose
4. **Get Feedback**: Watch the skeleton overlay and confidence meter
5. **Adjust Settings**:
    - Change confidence threshold (Easy/Medium/Hard/Expert)
    - Toggle sound on/off
    - Zoom in/out for better framing
    - Switch camera (mobile devices)

### Tips for Best Results

- **Good Lighting**: Ensure you're well-lit from the front
- **Full Body Visible**: Keep your entire body in frame
- **Plain Background**: A simple background improves detection
- **Stand Back**: Give yourself 6-8 feet from the camera
- **Wear Fitted Clothes**: Helps with accurate body tracking
- **Start Simple**: Begin with easier poses before attempting advanced ones

## ⚙️ Configuration

### Confidence Levels

Located in `constants/yoga.constants.ts`:

- **Easy (50%)**: Forgiving detection, great for beginners
- **Medium (60%)**: Balanced accuracy, recommended default
- **Hard (70%)**: Stricter matching for intermediate users
- **Expert (80%)**: Very precise detection for advanced practitioners

### Detection Thresholds

```typescript
export const DETECTION_THRESHOLDS = {
  minCriticalScore: 0.5,       // Minimum confidence for core body parts
  minCriticalVisible: 3,       // Minimum visible core keypoints
  minAvgConfidence: 0.35,      // Minimum average confidence
  keypointVisibility: 0.3,     // Minimum keypoint visibility
};
```

## 🎨 Customization

### Adding New Poses

1. Add pose image to `public/poses/`
2. Update `posesData.json`:
```json
{
  "name": "New Pose",
  "description": "Description of the pose",
  "image": "/poses/new-pose.jpg",
  "keypoints": []
}
```
3. Add detection logic in `utils/poseClassifier.ts`

### Styling

The app uses Tailwind CSS. Modify styles in:
- `globals.css` for global styles
- Component files for component-specific styles

## 🔧 Technologies Used

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **MediaPipe Pose Landmarker**: ML model for pose detection
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Canvas API**: Real-time skeleton rendering

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **MediaPipe Team**: For the excellent pose detection model
- **Yoga Community**: For pose definitions and guidance
- **Nannu**: Our virtual yoga instructor mascot!

## 📧 Contact

For questions, issues, or suggestions:
- Create an issue on GitHub
- Email: your.email@example.com

## 🐛 Known Issues

- Camera zoom may not work on all devices
- Some poses may be challenging to detect from certain angles
- Mobile performance varies by device capabilities

## 🔮 Future Enhancements

- [ ] Pose sequence/flow mode
- [ ] Session recording and playback
- [ ] Progress tracking and analytics
- [ ] Social sharing features
- [ ] Custom pose creation
- [ ] Multi-person detection
- [ ] Voice guidance
- [ ] Workout timer integration

---

**Made with ❤️ by the Yoga Pose Trainer Team**

*Practice regularly, stay consistent, and enjoy your yoga journey!* 🧘‍♀️✨