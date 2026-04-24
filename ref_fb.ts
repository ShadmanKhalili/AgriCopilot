import * as fs from 'fs';

let content = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

// Add feedback state
const declareStateStr = 'const [isTranslating, setIsTranslating] = useState(false);';
content = content.replace(
  declareStateStr,
  declareStateStr + '\n  const [feedbackGiven, setFeedbackGiven] = useState<\'up\' | \'down\' | null>(null);'
);

// We need to also reset this state when a new diagnosis is requested, let's find handleDiagnose.
// Actually, it's easier to reset it when `diagnosis` is set, or at the start of handleDiagnose.
const handleDiagnoseStr = 'setIsLoading(true);\n    setDiagnosis(null);\n    setDeepDiagnosis(null);';
content = content.replace(
  handleDiagnoseStr,
  handleDiagnoseStr + '\n    setFeedbackGiven(null);'
);

// Now update the feedback UI
const feedbackUIStart = content.indexOf('{/* Helpfulness Rating Section */}');
const feedbackUIEnd = content.indexOf('</div>', content.indexOf('<button', content.indexOf('<button', feedbackUIStart) + 1) + 200) + 6;

if (feedbackUIStart !== -1) {
    const originalFeedbackBlock = content.substring(feedbackUIStart, feedbackUIEnd);
    
    // Custom block with state
    const newFeedbackBlock = `
                              {/* Helpfulness Rating Section */}
                              <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Feedback Algorithm Input</div>
                                  <p className="text-xs font-bold text-gray-500">{lang === 'en' ? 'Was this diagnosis helpful?' : 'এই পরামর্শটি কি আপনার উপকারে এসেছে?'}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('up');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: true });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={\`p-3 rounded-xl border flex items-center space-x-2 transition-all \${feedbackGiven === 'up' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-green-600 disabled:opacity-50'}\`}
                                  >
                                    <ThumbsUp className={\`w-4 h-4 \${feedbackGiven === 'up' ? 'fill-current' : ''}\`} />
                                    {feedbackGiven === 'up' && <span className="text-xs font-bold pr-1">{lang === 'bn' ? 'উপকারী' : 'Helpful'}</span>}
                                  </button>
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('down');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: false });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={\`p-3 rounded-xl border flex items-center space-x-2 transition-all \${feedbackGiven === 'down' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-red-600 disabled:opacity-50'}\`}
                                  >
                                    <ThumbsDown className={\`w-4 h-4 \${feedbackGiven === 'down' ? 'fill-current' : ''}\`} />
                                  </button>
                                </div>
                              </div>
`;
    // We need to carefully replace the block.
    // The previous feedback UI ends after the second button's closing div? Let's check structure.
    
    // Because I don't know exact end, I'll use regex.
    content = content.replace(
        /\{\/\* Helpfulness Rating Section \*\/\}.*?<\/div>(\s+)<\/div>(\s+)<\/div>/s,
        newFeedbackBlock.trim() + "$1</div>$2</div>"
    );
}

fs.writeFileSync('src/components/AgriCopilot.tsx', content);
console.log('Feedback state added');
