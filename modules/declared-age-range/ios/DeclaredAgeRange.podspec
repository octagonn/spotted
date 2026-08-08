Pod::Spec.new do |s|
  s.name           = 'DeclaredAgeRange'
  s.version        = '1.0.0'
  s.summary        = 'Bridge to the iOS 26 DeclaredAgeRange framework (Age Assurance)'
  s.description    = 'Expo module exposing Apple\'s Declared Age Range API to JS. No-ops below iOS 26.'
  s.author         = 'Spotted'
  s.homepage       = 'https://github.com/spotted'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Weak-link so the binary still loads on iOS < 26 where the framework
  # doesn't exist; availability is guarded at runtime.
  s.weak_frameworks = 'DeclaredAgeRange'

  s.source_files = '**/*.{h,m,swift}'
end
