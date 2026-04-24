import * as fs from 'fs';

let content = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

const severityBlockStart = content.indexOf('<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">');
const severityBlockEnd = content.indexOf('                          {/* Deep Analysis Result or Button */}');

if (severityBlockStart === -1 || severityBlockEnd === -1) throw new Error("Could not find severity block");

const newSeverityBlock = `
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {/* Severity */}
                            <motion.div 
                              whileHover={{ y: -4, scale: 1.01 }}
                              className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 flex flex-col justify-center relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                              <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-gray-50 rounded-2xl">
                                  <AlertTriangle className="w-5 h-5 text-gray-500" />
                                </div>
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{lang === 'bn' ? 'সংক্রমণের মাত্রা' : 'Severity Level'}</p>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className={\`flex-1 h-3 rounded-full overflow-hidden bg-gray-100\`}>
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: diagnosis.qualitativeSeverity === 'High' ? '100%' : diagnosis.qualitativeSeverity === 'Medium' ? '60%' : '30%' }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={\`h-full \${
                                      diagnosis.qualitativeSeverity === 'High' ? 'bg-red-500' : 
                                      diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-500' : 
                                      'bg-green-500'
                                    }\`}
                                  />
                                </div>
                                <div className={\`px-5 py-2 rounded-xl font-black text-lg shadow-sm \${
                                  diagnosis.qualitativeSeverity === 'High' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                  diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                                  'bg-green-50 text-green-600 border border-green-100'
                                }\`}>
                                  {diagnosis.qualitativeSeverity === 'High' && lang === 'bn' ? 'উচ্চ' : 
                                   diagnosis.qualitativeSeverity === 'Medium' && lang === 'bn' ? 'মাঝারি' : 
                                   diagnosis.qualitativeSeverity === 'Low' && lang === 'bn' ? 'নিম্ন' : 
                                   diagnosis.qualitativeSeverity || 'Unknown'}
                                </div>
                              </div>
                            </motion.div>

                            {/* Symptoms Breakdown */}
                            <motion.div 
                              whileHover={{ y: -4, scale: 1.01 }}
                              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-6 border border-indigo-100/50 shadow-lg shadow-indigo-100/50 relative overflow-hidden flex flex-col"
                            >
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                              <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                                  <Bug className="w-5 h-5 text-indigo-500" />
                                </div>
                                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{lang === 'bn' ? 'শনাক্তকৃত লক্ষণ' : 'Visible Symptoms'}</p>
                              </div>
                              <ul className="space-y-2.5 flex-1 font-medium">
                                {diagnosis.symptomsBreakdown?.slice(0, 4).map((symptom: string, idx: number) => (
                                  <motion.li 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={idx} 
                                    className="flex items-start text-sm text-indigo-900/80"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 mr-2.5"></div>
                                    <span className="leading-snug">{symptom}</span>
                                  </motion.li>
                                ))}
                              </ul>
                            </motion.div>
                          </div>

                          {/* Differential Diagnosis (Chain of Thought Output) */}
                          {(diagnosis.possibleDiseases?.length > 0 || diagnosis.differentialDiagnosis) && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative z-10"
                            >
                              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                <Activity className="w-4 h-4 mr-2" />
                                {lang === 'bn' ? 'সম্ভাব্য রোগ ও পার্থক্য' : 'Differential Diagnosis'}
                              </h4>
                              
                              {diagnosis.possibleDiseases && diagnosis.possibleDiseases.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {diagnosis.possibleDiseases.map((disease: string, idx: number) => (
                                    <span key={idx} className="bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-lg text-xs font-bold">
                                      {disease}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {diagnosis.differentialDiagnosis && (
                                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                                  <p className="text-sm font-medium text-gray-700 leading-relaxed">
                                    <span className="font-bold text-orange-600 mr-2">Why this diagnosis?</span>
                                    {diagnosis.differentialDiagnosis}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}
`;

content = content.substring(0, severityBlockStart) + newSeverityBlock + '\n                          ' + content.substring(severityBlockEnd);

fs.writeFileSync('src/components/AgriCopilot.tsx', content);
console.log('Severity UI upgraded');
