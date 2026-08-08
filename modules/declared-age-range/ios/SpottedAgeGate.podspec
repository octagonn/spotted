Pod::Spec.new do |s|
  # NOTE: the pod / Swift-module name must NOT be 'DeclaredAgeRange' — that is
  # the name of Apple's system framework. If they collide, `import
  # DeclaredAgeRange` inside our Swift resolves to THIS module instead of
  # Apple's, `canImport(DeclaredAgeRange)` is true for the wrong reason, and the
  # build fails with "cannot find 'AgeRangeService' in scope". Keep this unique.
  s.name           = 'SpottedAgeGate'
  s.version        = '1.0.0'
  s.summary        = 'Bridge to the iOS 26 DeclaredAgeRange framework (Age Assurance)'
  s.description    = 'Expo module exposing Apple\'s Declared Age Range API to JS. No-ops below iOS 26.2.'
  s.author         = 'Spotted'
  s.homepage       = 'https://github.com/spotted'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Weak-link Apple's DeclaredAgeRange framework so the binary still loads on
  # iOS < 26.2 where the framework doesn't exist; availability is guarded at
  # runtime (#available) and at compile time (#if canImport).
  s.weak_frameworks = 'DeclaredAgeRange'

  s.source_files = '**/*.{h,m,swift}'
end
