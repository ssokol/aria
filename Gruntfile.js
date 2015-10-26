/**************************************************************************************

    Grunt configuration file
    
    Grunt is a taks runner that performs various common actions. In this case, the
    grunt configuration below is used to lint the text using jshint and to concatenate
    the various files together into the single 'index.js' file which is executed

**************************************************************************************/

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'), 
    watch: {
      js: {
        files: [
          'src/*.js',
          'Gruntfile.js'
        ],
        tasks: ['jshint', 'concat']
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: ['src/*.js']
    },
    concat: {
      options: {
        separator: ';',
      },
      dist: {
        src: ['src/aria_intro.js', 'src/aria_call.js', 'src/twiml_answer.js', 'src/twiml_say.js', 'src/twiml_play.js', 'src/twiml_gather.js', 'src/twiml_pause.js', 'src/twiml_dial.js', 'src/twiml_reject.js', 'src/twiml_hangup.js', 'src/aria.js'],
        dest: './index.js',
      },
    }
  });

  // Load the Grunt plugins.
  grunt.loadNpmTasks('grunt-contrib-compass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  
  // Register the default tasks.
  grunt.registerTask('default', ['watch']);
};
