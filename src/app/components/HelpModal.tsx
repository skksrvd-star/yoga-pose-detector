import React, { useState } from 'react';
import { X, Camera, Zap, Target, Music, Sliders, Info, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  posesData: Array<{
    name: string;
    description: string;
    image: string;
  }>;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, posesData }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'poses'>('guide');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', name: 'All Poses', count: posesData.length },
    { id: 'standing', name: 'Standing', keywords: ['mountain', 'tree', 'triangle', 'warrior', 'chair', 'forward bend', 'garland', 'standing split'] },
    { id: 'balance', name: 'Balance', keywords: ['tree', 'eagle', 'dancer', 'warrior iii', 'half moon'] },
    { id: 'seated', name: 'Seated', keywords: ['easy', 'lotus', 'hero', 'staff', 'boat', 'seated forward', 'head to knee', 'bound angle', 'half lord'] },
    { id: 'floor-prone', name: 'Floor (Prone)', keywords: ['cobra', 'upward dog', 'bow', 'locust', 'frog'] },
    { id: 'floor-supine', name: 'Floor (Supine)', keywords: ['bridge', 'fish', 'happy baby', 'corpse', 'reclined'] },
    { id: 'kneeling', name: 'Kneeling', keywords: ['child', 'cat', 'cow', 'camel', 'pigeon'] },
    { id: 'plank', name: 'Planks', keywords: ['plank', 'side plank', 'downward dog'] },
    { id: 'lunge', name: 'Lunges', keywords: ['high lunge', 'low lunge'] },
    { id: 'inversions', name: 'Inversions & Arm Balances', keywords: ['headstand', 'handstand', 'forearm stand', 'shoulder stand', 'plow', 'crow', 'peacock', 'firefly', 'eight-angle', 'scorpion'] },
  ];

  const filteredPoses = posesData.filter(pose => {
    const matchesSearch =
      pose.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pose.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedCategory === 'all') return matchesSearch;

    const category = categories.find(c => c.id === selectedCategory);
    if (!category || !category.keywords) return matchesSearch;

    const matchesCategory = category.keywords.some(keyword =>
      pose.name.toLowerCase().includes(keyword.toLowerCase()) ||
      pose.description.toLowerCase().includes(keyword.toLowerCase())
    );

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Help & Guide</h2>
            <p className="text-purple-100 mt-1">Learn how to use Yoga Pose Trainer</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-4 px-6 font-semibold transition-all ${
              activeTab === 'guide'
                ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            📖 How It Works
          </button>
          <button
            onClick={() => setActiveTab('poses')}
            className={`flex-1 py-4 px-6 font-semibold transition-all ${
              activeTab === 'poses'
                ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            🧘 All Poses ({posesData.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'guide' ? (
            <div className="p-6 space-y-8">
              {/* Quick Start */}
              <section>
                <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Zap className="text-yellow-500" />
                  Quick Start Guide
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Step 1 */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Start Your Camera</h4>
                        <p className="text-sm text-gray-600">Click the "Start Camera" button and allow camera access. Make sure your full body is visible.</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Select a Target Pose</h4>
                        <p className="text-sm text-gray-600">Browse the pose gallery and click on any pose you want to practice.</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Match the Pose</h4>
                        <p className="text-sm text-gray-600">Try to replicate the target pose. Watch the skeleton overlay and confidence meter for feedback.</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">Get Real-Time Feedback</h4>
                        <p className="text-sm text-gray-600">The app will detect your pose and show a match indicator. You'll hear a sound when poses are detected!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Features */}
              <section>
                <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Info className="text-blue-500" />
                  Key Features
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                    <Camera className="text-purple-600 flex-shrink-0" size={24} />
                    <div>
                      <h4 className="font-semibold text-gray-800">Camera Controls</h4>
                      <p className="text-sm text-gray-600 mt-1">Start/stop camera, switch between front/back cameras, and zoom in/out for better framing.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                    <Target className="text-green-600 flex-shrink-0" size={24} />
                    <div>
                      <h4 className="font-semibold text-gray-800">Pose Detection</h4>
                      <p className="text-sm text-gray-600 mt-1">Real-time pose detection using MediaPipe AI. See your skeleton overlay with confidence scores.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                    <Music className="text-orange-600 flex-shrink-0" size={24} />
                    <div>
                      <h4 className="font-semibold text-gray-800">Sound Feedback</h4>
                      <p className="text-sm text-gray-600 mt-1">Get audio notifications when poses are successfully detected. Toggle sound on/off anytime.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                    <Sliders className="text-blue-600 flex-shrink-0" size={24} />
                    <div>
                      <h4 className="font-semibold text-gray-800">Confidence Levels</h4>
                      <p className="text-sm text-gray-600 mt-1">Choose from Easy (50%), Medium (60%), Hard (70%), or Expert (80%) difficulty levels.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">💡 Nannu's Tips for Best Results</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 space-y-3">
                  {[
                    'Good Lighting: Practice in a well-lit area with light coming from the front',
                    'Full Body Visible: Keep your entire body in frame from head to toes',
                    'Plain Background: Use a simple, uncluttered background for better detection',
                    'Proper Distance: Stand 6-8 feet away from the camera',
                    'Fitted Clothing: Wear fitted clothes to help with accurate body tracking',
                    'Start Simple: Begin with easier poses before attempting advanced inversions',
                  ].map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                      <p className="text-gray-700">{tip}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Interface Guide */}
              <section>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">📊 Understanding the Interface</h3>
                <div className="space-y-4">
                  {[
                    {
                      title: '🎯 Target vs Detected',
                      color: 'purple-600',
                      desc: 'The Target image shows your selected pose, while the Detected image shows what the camera currently sees.',
                    },
                    {
                      title: '📈 Confidence Bar',
                      color: 'green-600',
                      desc: 'The confidence bar shows how accurately you are matching the target pose. Green (70%+) = Great, Yellow (40-70%) = Good, Red (<40%) = Keep trying!',
                    },
                    {
                      title: '🦴 Skeleton Overlay',
                      color: 'blue-600',
                      desc: 'The skeleton shows detected body keypoints and connections. Purple/pink color indicates a detected pose, gray means no pose detected.',
                    },
                    {
                      title: '🔢 Pose Counter',
                      color: 'orange-600',
                      desc: 'Tracks how many different poses you have successfully held during your session.',
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <h4 className={`font-semibold text-${item.color} mb-2`}>{item.title}</h4>
                      <p className="text-sm text-gray-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div>
              {/* Search and Filter */}
              <div className="sticky top-0 bg-white pb-4 border-b border-gray-200 space-y-4 z-10 p-6">
                <input
                  type="text"
                  placeholder="Search poses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />

                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="text-sm text-gray-600">
                  Showing {filteredPoses.length} of {posesData.length} poses
                </div>
              </div>

              {/* Poses Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
                {filteredPoses.map((pose, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-square bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
                      <img
                        src={pose.image}
                        alt={pose.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1">{pose.name}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2">{pose.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {filteredPoses.length === 0 && (
                <div className="text-center py-12 px-6">
                  <p className="text-gray-500 text-lg">No poses found matching your search.</p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            Made with ❤️ using MediaPipe Pose Landmarker • Practice regularly and stay consistent! 🧘‍♀️
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
